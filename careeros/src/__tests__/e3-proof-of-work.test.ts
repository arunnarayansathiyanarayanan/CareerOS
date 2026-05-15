/**
 * E3 Proof-of-Work — integration & QA suite (Vitest + supertest + Testing Library).
 *
 * Requires DATABASE_URL and (for storage routes) mocked Supabase admin unless env provides keys.
 */
import * as React from "react";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import http from "node:http";
import { render, screen } from "@testing-library/react";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";

const authState = vi.hoisted(() => ({
  user: null as {
    id: string;
    clerkId: string;
    email: string;
    username: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null,
}));

vi.mock("@/lib/auth", () => ({
  getSessionClerkUserId: vi.fn(async () => authState.user?.clerkId ?? null),
  getClerkAppSession: vi.fn(async () => {
    if (!authState.user) {
      return { status: "signed_out" as const };
    }
    return {
      status: "authenticated" as const,
      clerkUserId: authState.user.clerkId,
      appUser: authState.user,
    };
  }),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null as null })),
        remove: vi.fn(async () => ({ error: null as null })),
        getPublicUrl: vi.fn((key: string) => ({
          data: { publicUrl: `https://unit.test/storage/${encodeURIComponent(key)}` },
        })),
      })),
    },
  }),
}));

const reviewMock = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock("@/lib/ai/project-reviewer", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/ai/project-reviewer")>();
  return {
    ...mod,
    reviewProject: ((input: Parameters<typeof mod.reviewProject>[0]) =>
      reviewMock.fn(input)) as typeof mod.reviewProject,
  };
});

import { GET as getOgProject } from "@/app/api/og/project/route";
import { POST as postProjects } from "@/app/api/projects/route";
import { GET as getTemplates } from "@/app/api/projects/templates/route";
import { PATCH as patchProject, DELETE as deleteProject } from "@/app/api/projects/[id]/route";
import {
  POST as postEmbeds,
} from "@/app/api/projects/[id]/embeds/route";
import { DELETE as deleteEmbed } from "@/app/api/projects/[id]/embeds/[embedId]/route";
import { POST as postRecruiterShare } from "@/app/api/projects/[id]/recruiter-share/route";
import { POST as postReview } from "@/app/api/projects/[id]/review/route";
import { GET as getProjectByUserSlug } from "@/app/api/projects/by-slug/[username]/[slug]/route";
import { GET as getRecruiterView } from "@/app/api/r/[token]/route";
import { getDb } from "@/db";
import {
  projectEmbeds,
  projectPublishRateLimit,
  projectTemplates,
  projects,
  recruiterShareTokens,
} from "@/db/schema/projects";
import { users } from "@/db/schema/users";
import { autoTagSkills } from "@/lib/ai/skill-tagger";
import { PublicProjectEmbeds } from "@/components/projects/PublicProjectEmbeds";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000099";
const TEST_USER_ID_2 = "00000000-0000-0000-0000-000000000098";
const CLERK_1 = "clerk_e3_proof_1";
const CLERK_2 = "clerk_e3_proof_2";

async function clearPublishRateLimitForPrimaryUser() {
  await getDb()
    .delete(projectPublishRateLimit)
    .where(eq(projectPublishRateLimit.userId, TEST_USER_ID));
}

type SuiteReport = {
  pass: boolean;
  passed: number;
  failed: number;
  failures: { name: string; detail: string }[];
};

function emptyReport(): SuiteReport {
  return { pass: true, passed: 0, failed: 0, failures: [] };
}

const RUNTIME: Record<string, SuiteReport> = {
  db: emptyReport(),
  crud: emptyReport(),
  embeds: emptyReport(),
  recruiter: emptyReport(),
  review: emptyReport(),
  skills: emptyReport(),
  og: emptyReport(),
  privacy: emptyReport(),
  templates: emptyReport(),
  ownership: emptyReport(),
  ui: emptyReport(),
};

function trackPass(suite: keyof typeof RUNTIME) {
  RUNTIME[suite].passed += 1;
}

function trackFail(suite: keyof typeof RUNTIME, name: string, detail: string) {
  RUNTIME[suite].failed += 1;
  RUNTIME[suite].pass = false;
  RUNTIME[suite].failures.push({ name, detail });
  console.error(`\n[E3 FAIL] ${suite} :: ${name}\n${detail}\n`);
}

function wrapIt(suite: keyof typeof RUNTIME, name: string, fn: () => Promise<void>) {
  it(name, async () => {
    try {
      await fn();
      trackPass(suite);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      let dbSnap = "";
      try {
        const db = getDb();
        const [lim] = await db
          .select()
          .from(projectPublishRateLimit)
          .where(eq(projectPublishRateLimit.userId, TEST_USER_ID));
        dbSnap = `project_publish_rate_limit: ${JSON.stringify(lim ?? null)}`;
      } catch {
        dbSnap = "(could not read DB snapshot)";
      }
      trackFail(suite, name, `${err.message}\n${err.stack ?? ""}\n${dbSnap}`);
      throw e;
    }
  });
}

const LONG_PROBLEM =
  "Enterprise teams waste hours searching internal docs. This system lets users query a 10,000-doc knowledge base in natural language with 92% retrieval accuracy.";

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "RAG Pipeline with LangChain",
    one_liner: "Built an end-to-end RAG system for document Q&A",
    problem_solved: LONG_PROBLEM,
    ai_stack: ["LangChain", "Pinecone", "Python", "OpenAI API"],
    my_role: "Solo builder",
    outcome: "Reduced search time by 70% in user testing with 15 participants.",
    privacy_mode: "public",
    ...overrides,
  };
}

const createdProjectIds = new Set<string>();
let templateIdForTests: string | null = null;

function rememberProjectId(id: string) {
  createdProjectIds.add(id);
}

async function collectBody(req: IncomingMessage): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function dispatchApi(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const p = u.pathname;
  const method = req.method ?? "GET";

  if (p === "/api/projects" && method === "POST") {
    return postProjects(req);
  }
  if (p === "/api/projects/templates" && method === "GET") {
    return getTemplates(req);
  }
  if (p === "/api/og/project" && method === "GET") {
    return getOgProject(req as import("next/server").NextRequest);
  }

  const rToken = p.match(/^\/api\/r\/([^/]+)$/);
  if (rToken && method === "GET") {
    const token = decodeURIComponent(rToken[1]);
    return getRecruiterView(req, { params: Promise.resolve({ token }) });
  }

  const mReview = p.match(/^\/api\/projects\/([0-9a-f-]{36})\/review$/i);
  if (mReview && method === "POST") {
    return postReview(req, { params: Promise.resolve({ id: mReview[1] }) });
  }

  const mRecruiter = p.match(/^\/api\/projects\/([0-9a-f-]{36})\/recruiter-share$/i);
  if (mRecruiter && method === "POST") {
    return postRecruiterShare(req, { params: Promise.resolve({ id: mRecruiter[1] }) });
  }

  const mEmbedDel = p.match(
    /^\/api\/projects\/([0-9a-f-]{36})\/embeds\/([0-9a-f-]{36})$/i
  );
  if (mEmbedDel && method === "DELETE") {
    return deleteEmbed(req, {
      params: Promise.resolve({ id: mEmbedDel[1], embedId: mEmbedDel[2] }),
    });
  }

  const mEmbeds = p.match(/^\/api\/projects\/([0-9a-f-]{36})\/embeds$/i);
  if (mEmbeds && method === "POST") {
    return postEmbeds(req, { params: Promise.resolve({ id: mEmbeds[1] }) });
  }

  const mProjId = p.match(/^\/api\/projects\/([0-9a-f-]{36})$/i);
  if (mProjId && method === "PATCH") {
    return patchProject(req, { params: Promise.resolve({ id: mProjId[1] }) });
  }
  if (mProjId && method === "DELETE") {
    return deleteProject(req, { params: Promise.resolve({ id: mProjId[1] }) });
  }

  const mUserSlug = p.match(/^\/api\/projects\/([^/]+)\/([^/]+)$/);
  if (mUserSlug && method === "GET" && mUserSlug[1] !== "templates") {
    const username = decodeURIComponent(mUserSlug[1]);
    const slug = decodeURIComponent(mUserSlug[2]);
    return getProjectByUserSlug(req, {
      params: Promise.resolve({ username, slug }),
    });
  }

  return new Response(JSON.stringify({ error: "Test router: no match", path: p }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
}

function createTestServer(): Server {
  return http.createServer((nodeReq, nodeRes) => {
    void handleIncoming(nodeReq, nodeRes);
  });
}

async function handleIncoming(nodeReq: IncomingMessage, nodeRes: ServerResponse) {
  try {
    const buf = await collectBody(nodeReq);
    const host = "127.0.0.1";
    const url = new URL(nodeReq.url ?? "/", `http://${host}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(nodeReq.headers)) {
      if (v == null) continue;
      if (Array.isArray(v)) for (const part of v) headers.append(k, part);
      else headers.set(k, v);
    }
    const init: RequestInit = {
      method: nodeReq.method,
      headers,
      body:
        nodeReq.method !== "GET" && nodeReq.method !== "HEAD" && buf.length > 0
          ? buf
          : undefined,
    };
    const webReq = new Request(url.toString(), init);
    const res = await dispatchApi(webReq);
    nodeRes.statusCode = res.status;
    res.headers.forEach((v, k) => {
      if (k === "transfer-encoding") return;
      nodeRes.setHeader(k, v);
    });
    nodeRes.end(Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.error(e);
    nodeRes.statusCode = 599;
    nodeRes.end(String(e));
  }
}

let testServer: Server;

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for E3 tests (set in .env.local).");
  }
  const db = getDb();
  const existingProjectIds = await db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.userId, [TEST_USER_ID, TEST_USER_ID_2]));

  const pidList = existingProjectIds.map((r) => r.id);
  if (pidList.length > 0) {
    await db
      .delete(recruiterShareTokens)
      .where(inArray(recruiterShareTokens.projectId, pidList));
    await db.delete(projectEmbeds).where(inArray(projectEmbeds.projectId, pidList));
    await db.delete(projects).where(inArray(projects.id, pidList));
  }

  await db.delete(projectPublishRateLimit).where(
    inArray(projectPublishRateLimit.userId, [TEST_USER_ID, TEST_USER_ID_2])
  );
  await db.delete(users).where(inArray(users.id, [TEST_USER_ID, TEST_USER_ID_2]));

  await db.insert(users).values({
    id: TEST_USER_ID,
    clerkId: CLERK_1,
    email: "e3-primary@test.local",
    username: "test-user-e3",
  });
  await db.insert(users).values({
    id: TEST_USER_ID_2,
    clerkId: CLERK_2,
    email: "e3-secondary@test.local",
    username: "other-e3-user",
  });

  authState.user = {
    id: TEST_USER_ID,
    clerkId: CLERK_1,
    email: "e3-primary@test.local",
    username: "test-user-e3",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  reviewMock.fn.mockImplementation(
    async (input: {
      problem_solved: string;
      embeds: unknown[];
    }) => {
      const score = 8;
      const portfolio_ready =
        score >= 5 &&
        input.problem_solved.trim().length >= 100 &&
        input.embeds.length >= 1;
      return {
        score,
        strengths: ["s1 specific strength one", "s2 specific strength two", "s3 specific strength three"],
        improvements: ["i1 actionable one", "i2 actionable two", "i3 actionable three"],
        portfolio_ready,
        reasoning: "Deterministic reviewer stub for E3 tests.",
      };
    }
  );

  testServer = createTestServer();

  const [tpl] = await db
    .insert(projectTemplates)
    .values({
      title: "Spec template — AI PM",
      description: "Test",
      problemStatement: "Test problem",
      recommendedStack: ["LangGraph", "FastAPI", "Python"],
      successCriteria: "Ship",
      completionChecklist: [{ label: "Demo", required: true }],
      targetRoles: ["AI Product Manager"],
    })
    .returning({ id: projectTemplates.id });
  templateIdForTests = tpl?.id ?? null;
});

afterEach(() => {
  authState.user = {
    id: TEST_USER_ID,
    clerkId: CLERK_1,
    email: "e3-primary@test.local",
    username: "test-user-e3",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});

afterAll(async () => {
  const db = getDb();
  const ids = [...createdProjectIds];
  if (ids.length) {
    await db.delete(recruiterShareTokens).where(inArray(recruiterShareTokens.projectId, ids));
    await db.delete(projectEmbeds).where(inArray(projectEmbeds.projectId, ids));
    await db.delete(projects).where(inArray(projects.id, ids));
  }
  await db.delete(projects).where(eq(projects.username, "test-user-e3"));
  await db.delete(projects).where(eq(projects.userId, TEST_USER_ID_2));
  await db.delete(projectPublishRateLimit).where(
    inArray(projectPublishRateLimit.userId, [TEST_USER_ID, TEST_USER_ID_2])
  );
  if (templateIdForTests) {
    await db.delete(projectTemplates).where(eq(projectTemplates.id, templateIdForTests));
  }
  await db.delete(users).where(inArray(users.id, [TEST_USER_ID, TEST_USER_ID_2]));

  testServer?.close();

  const totalPass = Object.values(RUNTIME).reduce((a, s) => a + s.passed, 0);
  const totalFail = Object.values(RUNTIME).reduce((a, s) => a + s.failed, 0);
  const dbOk = RUNTIME.db.pass && RUNTIME.db.failed === 0;

  console.log(`
=== E3 PROOF-OF-WORK SYSTEM — TEST RESULTS ===
DB Health:         [${dbOk ? "PASS" : "FAIL"}]
Project CRUD:      [${RUNTIME.crud.pass ? "PASS" : "FAIL"}] (${RUNTIME.crud.passed}/${RUNTIME.crud.passed + RUNTIME.crud.failed} tests)
Embeds:            [${RUNTIME.embeds.pass ? "PASS" : "FAIL"}] (${RUNTIME.embeds.passed}/${RUNTIME.embeds.passed + RUNTIME.embeds.failed} tests)
Recruiter Share:   [${RUNTIME.recruiter.pass ? "PASS" : "FAIL"}] (${RUNTIME.recruiter.passed}/${RUNTIME.recruiter.passed + RUNTIME.recruiter.failed} tests)
AI Reviewer:       [${RUNTIME.review.pass ? "PASS" : "FAIL"}] (${RUNTIME.review.passed}/${RUNTIME.review.passed + RUNTIME.review.failed} tests)
Skill Auto-Tagger: [${RUNTIME.skills.pass ? "PASS" : "FAIL"}] (${RUNTIME.skills.passed}/${RUNTIME.skills.passed + RUNTIME.skills.failed} tests)
OG Image:          [${RUNTIME.og.pass ? "PASS" : "FAIL"}] (${RUNTIME.og.passed}/${RUNTIME.og.passed + RUNTIME.og.failed} tests)
Privacy Modes:     [${RUNTIME.privacy.pass ? "PASS" : "FAIL"}] (${RUNTIME.privacy.passed}/${RUNTIME.privacy.passed + RUNTIME.privacy.failed} tests)
Templates:         [${RUNTIME.templates.pass ? "PASS" : "FAIL"}] (${RUNTIME.templates.passed}/${RUNTIME.templates.passed + RUNTIME.templates.failed} tests)
Ownership Guards:  [${RUNTIME.ownership.pass ? "PASS" : "FAIL"}] (${RUNTIME.ownership.passed}/${RUNTIME.ownership.passed + RUNTIME.ownership.failed} tests)
UI (RTL):          [${RUNTIME.ui.pass ? "PASS" : "FAIL"}] (${RUNTIME.ui.passed}/${RUNTIME.ui.passed + RUNTIME.ui.failed} tests)
================================================
TOTAL: ${totalPass} passed, ${totalFail} failed
`);
});

describe("0. DB connection health", () => {
  it("connects and E3 tables expose expected columns", async () => {
    try {
      const db = getDb();
      const tables = [
        "projects",
        "project_embeds",
        "recruiter_share_tokens",
        "project_templates",
        "project_publish_rate_limit",
      ] as const;

      const required: Record<(typeof tables)[number], string[]> = {
        projects: [
          "id",
          "user_id",
          "username",
          "slug",
          "privacy_mode",
          "ai_reviewer_score",
          "auto_tags",
          "is_deleted",
        ],
        project_embeds: ["type", "storage_key", "file_size_bytes", "display_order"],
        recruiter_share_tokens: ["token", "expires_at", "is_revoked"],
        project_publish_rate_limit: ["user_id", "window_start", "count"],
        project_templates: [
          "id",
          "title",
          "recommended_stack",
          "completion_checklist",
        ],
      };

      for (const table of tables) {
        try {
          const executed = await db.execute(
            sql.raw(
              `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}'`
            )
          );
          const rowArr = executed as unknown as {
            rows?: { column_name: string }[];
          };
          const cols = rowArr.rows
            ? rowArr.rows.map((r) => r.column_name)
            : (executed as unknown as { column_name: string }[]).map(
                (r) => r.column_name
              );
          expect(cols.length, table).toBeGreaterThan(0);
          for (const c of required[table]) {
            expect(cols, `${table}.${c}`).toContain(c);
          }
          console.log(`✅ Table ${table} OK`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`❌ Table ${table} MISSING/BROKEN: ${msg}`);
          throw e;
        }
      }
      RUNTIME.db.pass = RUNTIME.db.failed === 0;
      trackPass("db");
    } catch (e) {
      RUNTIME.db.pass = false;
      trackFail(
        "db",
        "DB health",
        e instanceof Error ? e.message : String(e)
      );
      throw e;
    }
  });
});

describe("1. Project CRUD", () => {
  let PROJECT_ID = "";
  let PROJECT_SLUG = "";

  afterAll(async () => {
    await clearPublishRateLimitForPrimaryUser();
  });

  wrapIt("crud", "1a CREATE happy path", async () => {
    const res = await request(testServer)
      .post("/api/projects")
      .set("Content-Type", "application/json")
      .send(validCreateBody());
    expect(res.status, res.text).toBe(201);
    const body = res.body as {
      project: { id: string; slug: string };
      public_url: string;
    };
    expect(body.project?.id).toBeTruthy();
    PROJECT_ID = body.project.id;
    PROJECT_SLUG = body.project.slug;
    rememberProjectId(PROJECT_ID);
    expect(body.public_url).toMatch(/careeros\.com\/p\/test-user-e3\/.+/);
  });

  wrapIt("crud", "1b validation failures return 422", async () => {
    const base = validCreateBody();
    const r1 = await request(testServer)
      .post("/api/projects")
      .send({ ...base, problem_solved: "x".repeat(99) });
    expect(r1.status).toBe(422);

    const r2 = await request(testServer)
      .post("/api/projects")
      .send({ ...base, ai_stack: ["FakeTool99XYZ"] });
    expect(r2.status).toBe(422);
    const msg = JSON.stringify(r2.body);
    expect(msg.toLowerCase()).toMatch(/skill|ontology/);

    const r3 = await request(testServer)
      .post("/api/projects")
      .send({ ...base, privacy_mode: "invisible" });
    expect(r3.status).toBe(422);

    const { title: _t, ...noTitle } = base;
    void _t;
    const r4 = await request(testServer).post("/api/projects").send(noTitle);
    expect(r4.status).toBe(422);

    const { outcome: _o, ...noOutcome } = base;
    void _o;
    const r5 = await request(testServer).post("/api/projects").send(noOutcome);
    expect(r5.status).toBe(422);
  });

  wrapIt("crud", "1c rate limit on 6th publish in 24h window", async () => {
    for (let i = 0; i < 4; i++) {
      const res = await request(testServer)
        .post("/api/projects")
        .send(
          validCreateBody({
            title: `Rate limit project ${i + 1} ${Date.now()}`,
          })
        );
      expect(res.status).toBe(201);
      rememberProjectId((res.body as { project: { id: string } }).project.id);
    }
    const blocked = await request(testServer)
      .post("/api/projects")
      .send(
        validCreateBody({
          title: `Rate limit blocked ${Date.now()}`,
        })
      );
    expect(blocked.status).toBe(429);
    expect(String(blocked.body?.error ?? "")).toMatch(/limit reached/i);
    const db = getDb();
    const [lim] = await db
      .select()
      .from(projectPublishRateLimit)
      .where(eq(projectPublishRateLimit.userId, TEST_USER_ID));
    expect(lim?.count).toBe(5);
  });

  wrapIt("crud", "1d GET public project (no auth)", async () => {
    authState.user = null;
    const res = await request(testServer).get(
      `/api/projects/by-slug/${encodeURIComponent("test-user-e3")}/${encodeURIComponent(PROJECT_SLUG)}`
    );
    expect(res.status).toBe(200);
    expect(res.body.project.title).toBe("RAG Pipeline with LangChain");
    authState.user = {
      id: TEST_USER_ID,
      clerkId: CLERK_1,
      email: "e3-primary@test.local",
      username: "test-user-e3",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  wrapIt("crud", "1e PATCH partial update and ai_stack resets reviewer", async () => {
    const db = getDb();
    await db
      .update(projects)
      .set({
        aiReviewerScore: 7,
        aiReviewerData: {
          strengths: ["a", "b", "c"],
          improvements: ["x", "y", "z"],
          portfolio_ready: true,
        },
        aiReviewerCallCount: 0,
      })
      .where(eq(projects.id, PROJECT_ID));

    const r1 = await request(testServer)
      .patch(`/api/projects/${PROJECT_ID}`)
      .send({ outcome: "Updated outcome text" });
    expect(r1.status).toBe(200);
    expect((r1.body as { project: { outcome: string } }).project.outcome).toBe(
      "Updated outcome text"
    );

    const r2 = await request(testServer)
      .patch(`/api/projects/${PROJECT_ID}`)
      .send({ ai_stack: ["LangChain", "Pinecone", "Python"] });
    expect(r2.status).toBe(200);
    const [row] = await db.select().from(projects).where(eq(projects.id, PROJECT_ID));
    expect(row?.aiReviewerScore).toBeNull();
  });

  wrapIt("crud", "1f DELETE soft-deletes and public GET 404", async () => {
    const res = await request(testServer).delete(`/api/projects/${PROJECT_ID}`);
    expect(res.status).toBe(200);
    const msg = String((res.body as { message?: string }).message ?? "");
    expect(msg).toMatch(/404/i);
    expect(msg.toLowerCase()).toMatch(/recruiter/);

    const db = getDb();
    const [row] = await db.select().from(projects).where(eq(projects.id, PROJECT_ID));
    expect(row?.isDeleted).toBe(true);
    expect(row?.publishedAt).toBeNull();

    authState.user = null;
    const g = await request(testServer).get(
      `/api/projects/by-slug/${encodeURIComponent("test-user-e3")}/${encodeURIComponent(PROJECT_SLUG)}`
    );
    expect(g.status).toBe(404);
  });
});

describe("2. Embeds", () => {
  let PROJECT_ID_2 = "";

  beforeAll(async () => {
    await clearPublishRateLimitForPrimaryUser();
    authState.user = {
      id: TEST_USER_ID,
      clerkId: CLERK_1,
      email: "e3-primary@test.local",
      username: "test-user-e3",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const res = await request(testServer)
      .post("/api/projects")
      .send(
        validCreateBody({
          title: `Embeds parent ${Date.now()}`,
        })
      );
    PROJECT_ID_2 = (res.body as { project: { id: string } }).project.id;
    rememberProjectId(PROJECT_ID_2);
  });

  for (const type of ["github", "loom", "youtube", "notion", "deployed_url"] as const) {
    wrapIt("embeds", `2a add embed type ${type}`, async () => {
      const res = await request(testServer)
        .post(`/api/projects/${PROJECT_ID_2}/embeds`)
        .set("Content-Type", "application/json")
        .send({ type, url: "https://example.com/test" });
      expect(res.status).toBe(201);
      expect((res.body as { embed: { type: string } }).embed.type).toBe(type);
    });
  }

  wrapIt("embeds", "2b screenshot max 10 then 422", async () => {
    for (let i = 0; i < 10; i++) {
      const buf = Buffer.alloc(64, i);
      const res = await request(testServer)
        .post(`/api/projects/${PROJECT_ID_2}/embeds`)
        .field("type", "screenshot")
        .attach("file", buf, {
          filename: `shot-${i}.png`,
          contentType: "image/png",
        });
      expect(res.status).toBe(201);
    }
    const buf11 = Buffer.alloc(64, 11);
    const bad = await request(testServer)
      .post(`/api/projects/${PROJECT_ID_2}/embeds`)
      .field("type", "screenshot")
      .attach("file", buf11, {
        filename: "shot-11.png",
        contentType: "image/png",
      });
    expect([400, 422]).toContain(bad.status);
    expect(String(bad.body?.error ?? "")).toMatch(/max 10|Maximum of 10 screenshots/i);
  });

  wrapIt("embeds", "2c PDF over 25MB returns 413 or 422", async () => {
    const big = Buffer.alloc(26 * 1024 * 1024, 0);
    const res = await request(testServer)
      .post(`/api/projects/${PROJECT_ID_2}/embeds`)
      .field("type", "pdf")
      .attach("file", big, {
        filename: "big.pdf",
        contentType: "application/pdf",
      });
    expect([413, 422]).toContain(res.status);
    expect(String(res.body?.error ?? "")).toMatch(/25\s*MB/i);
  });

  wrapIt("embeds", "2d DELETE embed removes row", async () => {
    const ins = await request(testServer)
      .post(`/api/projects/${PROJECT_ID_2}/embeds`)
      .set("Content-Type", "application/json")
      .send({ type: "github", url: "https://example.com/to-delete" });
    const embedId = (ins.body as { embed: { id: string } }).embed.id;
    const del = await request(testServer).delete(
      `/api/projects/${PROJECT_ID_2}/embeds/${embedId}`
    );
    expect(del.status).toBe(200);
    const db = getDb();
    const rows = await db
      .select()
      .from(projectEmbeds)
      .where(and(eq(projectEmbeds.id, embedId), eq(projectEmbeds.projectId, PROJECT_ID_2)));
    expect(rows.length).toBe(0);
  });
});

describe("3. Recruiter share token", () => {
  let PROJECT_ID_3 = "";
  let TOKEN = "";

  beforeAll(async () => {
    await clearPublishRateLimitForPrimaryUser();
    const res = await request(testServer)
      .post("/api/projects")
      .send(
        validCreateBody({
          title: `Recruiter share ${Date.now()}`,
          privacy_mode: "recruiter_share",
        })
      );
    PROJECT_ID_3 = (res.body as { project: { id: string } }).project.id;
    rememberProjectId(PROJECT_ID_3);
  });

  wrapIt("recruiter", "3a generate token", async () => {
    const res = await request(testServer).post(
      `/api/projects/${PROJECT_ID_3}/recruiter-share`
    );
    expect(res.status).toBe(200);
    const b = res.body as { token: string; share_url: string; expires_at: string };
    expect(b.token).toMatch(/^[0-9a-f]{32}$/i);
    expect(b.share_url).toBeTruthy();
    TOKEN = b.token;
    const exp = new Date(b.expires_at).getTime();
    const target = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(exp - target)).toBeLessThanOrEqual(60_000);

    const db = getDb();
    const [row] = await db
      .select()
      .from(recruiterShareTokens)
      .where(eq(recruiterShareTokens.token, TOKEN));
    expect(row).toBeTruthy();
    expect(row?.isRevoked).toBe(false);
  });

  wrapIt("recruiter", "3b GET /api/r/:token strips PII and sets accessed_at", async () => {
    const res = await request(testServer).get(`/api/r/${encodeURIComponent(TOKEN)}`);
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).toMatch(/outcome|ai_stack|my_role|embeds/);
    const bodyObj = res.body as Record<string, unknown>;
    expect(bodyObj.user_id).toBeUndefined();
    expect(bodyObj.userId).toBeUndefined();
    expect(bodyObj.email).toBeUndefined();
    expect(bodyObj.username).toBeUndefined();
    expect(raw.toLowerCase()).not.toContain("user_id");
    expect(raw.toLowerCase()).not.toContain("email");

    const db = getDb();
    const [row] = await db
      .select()
      .from(recruiterShareTokens)
      .where(eq(recruiterShareTokens.token, TOKEN));
    expect(row?.accessedAt).toBeTruthy();
  });

  wrapIt("recruiter", "3c expired token rejected", async () => {
    const db = getDb();
    await db
      .update(recruiterShareTokens)
      .set({ expiresAt: new Date(Date.now() - 86400_000) })
      .where(eq(recruiterShareTokens.token, TOKEN));
    const res = await request(testServer).get(`/api/r/${encodeURIComponent(TOKEN)}`);
    expect([401, 404]).toContain(res.status);
  });

  wrapIt("recruiter", "3d project delete revokes tokens", async () => {
    const gen = await request(testServer).post(
      `/api/projects/${PROJECT_ID_3}/recruiter-share`
    );
    const token2 = (gen.body as { token: string }).token;
    await request(testServer).delete(`/api/projects/${PROJECT_ID_3}`);

    const db = getDb();
    const [row] = await db
      .select()
      .from(recruiterShareTokens)
      .where(
        and(eq(recruiterShareTokens.token, token2), eq(recruiterShareTokens.isRevoked, true))
      );
    expect(row).toBeTruthy();

    const res = await request(testServer).get(`/api/r/${encodeURIComponent(token2)}`);
    expect([401, 404]).toContain(res.status);
  });
});

describe("4. AI reviewer", () => {
  let PROJECT_ID_4 = "";

  beforeAll(async () => {
    await clearPublishRateLimitForPrimaryUser();
    const res = await request(testServer)
      .post("/api/projects")
      .send(validCreateBody({ title: `AI review target ${Date.now()}` }));
    PROJECT_ID_4 = (res.body as { project: { id: string } }).project.id;
    rememberProjectId(PROJECT_ID_4);
    await request(testServer)
      .post(`/api/projects/${PROJECT_ID_4}/embeds`)
      .set("Content-Type", "application/json")
      .send({ type: "github", url: "https://example.com/repo" });
  });

  wrapIt("review", "4a happy path shape and DB persistence", async () => {
    const res = await request(testServer).post(`/api/projects/${PROJECT_ID_4}/review`);
    expect(res.status).toBe(200);
    const b = res.body as {
      score: number;
      strengths: string[];
      improvements: string[];
      portfolio_ready: boolean;
      reasoning: string;
    };
    expect(b.score).toBeGreaterThanOrEqual(1);
    expect(b.score).toBeLessThanOrEqual(10);
    expect(b.strengths).toHaveLength(3);
    expect(b.improvements).toHaveLength(3);
    expect(typeof b.portfolio_ready).toBe("boolean");
    expect(b.reasoning.length).toBeGreaterThan(0);

    const db = getDb();
    const [row] = await db.select().from(projects).where(eq(projects.id, PROJECT_ID_4));
    expect(row?.aiReviewerScore).toBe(b.score);
    expect(row?.aiReviewerData?.portfolio_ready).toBe(b.portfolio_ready);
  });

  wrapIt("review", "4b rejects review when no proof embeds", async () => {
    const res = await request(testServer)
      .post("/api/projects")
      .send(validCreateBody({ title: `No embeds ${Date.now()}`, privacy_mode: "public" }));
    expect(res.status).toBe(201);
    const pid = (res.body as { project: { id: string } }).project.id;
    rememberProjectId(pid);
    const db = getDb();
    await db
      .update(projects)
      .set({ problemSolved: "x".repeat(120) })
      .where(eq(projects.id, pid));
    await db.delete(projectEmbeds).where(eq(projectEmbeds.projectId, pid));

    const rev = await request(testServer).post(`/api/projects/${pid}/review`);
    expect(rev.status).toBe(422);
    expect((rev.body as { code?: string }).code).toBe("EMBEDS_REQUIRED");
  });

  wrapIt("review", "4c fourth review returns 429", async () => {
    for (let i = 0; i < 2; i++) {
      const res = await request(testServer).post(`/api/projects/${PROJECT_ID_4}/review`);
      expect(res.status).toBe(200);
    }
    const last = await request(testServer).post(`/api/projects/${PROJECT_ID_4}/review`);
    expect(last.status).toBe(429);
  });

  wrapIt("review", "4d missing OPENAI_API_KEY returns 503", async () => {
    const res = await request(testServer)
      .post("/api/projects")
      .send(validCreateBody({ title: `503 review project ${Date.now()}` }));
    const pid = (res.body as { project: { id: string } }).project.id;
    rememberProjectId(pid);
    await request(testServer)
      .post(`/api/projects/${pid}/embeds`)
      .set("Content-Type", "application/json")
      .send({ type: "github", url: "https://example.com/review-openai-check" });
    const prev = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
      const rev = await request(testServer).post(`/api/projects/${pid}/review`);
      expect(rev.status).toBe(503);
      expect(String(rev.body?.error ?? "")).toMatch(/OPENAI|not configured|unavailable/i);
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });
});

describe("5. Skill auto-tagger", () => {
  beforeAll(async () => {
    await clearPublishRateLimitForPrimaryUser();
  });

  wrapIt("skills", "5a ontology exact match", async () => {
    const tags = await autoTagSkills(
      ["LangChain", "Pinecone", "Python"],
      "test",
      "test problem solved here for length ok ok ok"
    );
    const lower = tags.map((t) => t.toLowerCase());
    expect(lower).toContain("langchain");
    expect(lower).toContain("pinecone");
    expect(lower).toContain("python");
  });

  wrapIt("skills", "5b normalizes langchain; rejects unknown", async () => {
    const tags = await autoTagSkills(
      ["langchain", "some-obscure-tool-xyz"],
      "test",
      "test"
    );
    const lower = tags.map((t) => t.toLowerCase());
    expect(lower).toContain("langchain");
    expect(lower).not.toContain("some-obscure-tool-xyz");
  });

  wrapIt("skills", "5c auto_tags after create (background job)", async () => {
    const res = await request(testServer)
      .post("/api/projects")
      .send(
        validCreateBody({
          title: `Autotag ${Date.now()}`,
          ai_stack: ["LangGraph", "FastAPI"],
        })
      );
    const pid = (res.body as { project: { id: string } }).project.id;
    rememberProjectId(pid);
    await new Promise((r) => setTimeout(r, 2000));
    const db = getDb();
    const [row] = await db.select().from(projects).where(eq(projects.id, pid));
    const tags = (row?.autoTags ?? []).map((t) => t.toLowerCase());
    expect(tags).toContain("langgraph");
    expect(tags).toContain("fastapi");
  });
});

describe("6. OG image route", () => {
  let PROJECT_SLUG_2 = "";

  beforeAll(async () => {
    await clearPublishRateLimitForPrimaryUser();
    const res = await request(testServer)
      .post("/api/projects")
      .send(validCreateBody({ title: `OG target ${Date.now()}` }));
    PROJECT_SLUG_2 = (res.body as { project: { slug: string } }).project.slug;
    rememberProjectId((res.body as { project: { id: string } }).project.id);
  });

  wrapIt("og", "6a valid project returns PNG", async () => {
    const res = await request(testServer)
      .get("/api/og/project")
      .query({ username: "test-user-e3", slug: PROJECT_SLUG_2 });
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"] ?? "")).toContain("image/png");
    const len =
      typeof res.body === "string"
        ? res.body.length
        : Buffer.isBuffer(res.body)
          ? res.body.length
          : 0;
    expect(len).toBeGreaterThan(1024);
  });

  wrapIt("og", "6b missing slug returns 404 not 500", async () => {
    const res = await request(testServer)
      .get("/api/og/project")
      .query({ username: "test-user-e3", slug: "nonexistent-slug-xyz" });
    expect([404]).toContain(res.status);
  });
});

describe("7. Privacy modes (API)", () => {
  beforeAll(async () => {
    await clearPublishRateLimitForPrimaryUser();
  });

  wrapIt("privacy", "7a unlisted 401 without auth, 200 owner", async () => {
    const res = await request(testServer)
      .post("/api/projects")
      .send(
        validCreateBody({
          title: `Unlisted ${Date.now()}`,
          privacy_mode: "unlisted",
        })
      );
    const slug = (res.body as { project: { slug: string } }).project.slug;
    rememberProjectId((res.body as { project: { id: string } }).project.id);

    authState.user = null;
    const anon = await request(testServer).get(
      `/api/projects/by-slug/${encodeURIComponent("test-user-e3")}/${encodeURIComponent(slug)}`
    );
    expect(anon.status).toBe(401);

    authState.user = {
      id: TEST_USER_ID,
      clerkId: CLERK_1,
      email: "e3-primary@test.local",
      username: "test-user-e3",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const owner = await request(testServer).get(
      `/api/projects/by-slug/${encodeURIComponent("test-user-e3")}/${encodeURIComponent(slug)}`
    );
    expect(owner.status).toBe(200);
  });

  wrapIt("privacy", "7b public without auth", async () => {
    const res = await request(testServer)
      .post("/api/projects")
      .send(
        validCreateBody({
          title: `Public ${Date.now()}`,
          privacy_mode: "public",
        })
      );
    const slug = (res.body as { project: { slug: string } }).project.slug;
    rememberProjectId((res.body as { project: { id: string } }).project.id);
    authState.user = null;
    const g = await request(testServer).get(
      `/api/projects/by-slug/${encodeURIComponent("test-user-e3")}/${encodeURIComponent(slug)}`
    );
    expect(g.status).toBe(200);
  });

  wrapIt("privacy", "7c recruiter_share direct API and token view", async () => {
    const res = await request(testServer)
      .post("/api/projects")
      .send(
        validCreateBody({
          title: `Recruiter API ${Date.now()}`,
          privacy_mode: "recruiter_share",
        })
      );
    const slug = (res.body as { project: { slug: string } }).project.slug;
    const pid = (res.body as { project: { id: string } }).project.id;
    rememberProjectId(pid);

    authState.user = null;
    const blocked = await request(testServer).get(
      `/api/projects/by-slug/${encodeURIComponent("test-user-e3")}/${encodeURIComponent(slug)}`
    );
    expect(blocked.status).toBe(401);

    authState.user = {
      id: TEST_USER_ID,
      clerkId: CLERK_1,
      email: "e3-primary@test.local",
      username: "test-user-e3",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tok = await request(testServer).post(`/api/projects/${pid}/recruiter-share`);
    const token = (tok.body as { token: string }).token;
    authState.user = null;
    const r = await request(testServer).get(`/api/r/${encodeURIComponent(token)}`);
    expect(r.status).toBe(200);
  });
});

describe("8. Templates", () => {
  beforeAll(async () => {
    await clearPublishRateLimitForPrimaryUser();
  });

  wrapIt("templates", "8a list templates for AI Product Manager", async () => {
    expect(templateIdForTests).toBeTruthy();
    const res = await request(testServer)
      .get("/api/projects/templates")
      .query({ role: "AI Product Manager" });
    expect(res.status).toBe(200);
    const list = (res.body as { templates: unknown[] }).templates;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    const t = list[0] as Record<string, unknown>;
    expect(t.id).toBeTruthy();
    expect(t.title).toBeTruthy();
    expect(Array.isArray(t.recommended_stack)).toBe(true);
    expect(Array.isArray(t.completion_checklist)).toBe(true);
  });

  wrapIt("templates", "8b clone via template_id", async () => {
    const res = await request(testServer)
      .post("/api/projects")
      .send(
        validCreateBody({
          title: `From template ${Date.now()}`,
          template_id: templateIdForTests!,
          ai_stack: ["LangChain", "Pinecone", "Python", "OpenAI API"],
        })
      );
    expect(res.status).toBe(201);
    const stack = (res.body as { project: { ai_stack: string[] } }).project.ai_stack;
    expect(stack.map((s) => s.toLowerCase())).toContain("langgraph");
    expect(stack.map((s) => s.toLowerCase())).toContain("fastapi");
    rememberProjectId((res.body as { project: { id: string } }).project.id);
  });
});

describe("9. Ownership guards", () => {
  let PROJECT_ID_5 = "";

  beforeAll(async () => {
    await clearPublishRateLimitForPrimaryUser();
    authState.user = {
      id: TEST_USER_ID,
      clerkId: CLERK_1,
      email: "e3-primary@test.local",
      username: "test-user-e3",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const res = await request(testServer)
      .post("/api/projects")
      .send(validCreateBody({ title: `Ownership ${Date.now()}` }));
    PROJECT_ID_5 = (res.body as { project: { id: string } }).project.id;
    rememberProjectId(PROJECT_ID_5);
  });

  wrapIt("ownership", "403 for non-owner mutating routes", async () => {
    authState.user = {
      id: TEST_USER_ID_2,
      clerkId: CLERK_2,
      email: "e3-secondary@test.local",
      username: "other-e3-user",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    for (const [label, fn] of [
      [
        "PATCH",
        () =>
          request(testServer)
            .patch(`/api/projects/${PROJECT_ID_5}`)
            .send({ outcome: "nope" }),
      ],
      ["DELETE", () => request(testServer).delete(`/api/projects/${PROJECT_ID_5}`)],
      [
        "POST embed",
        () =>
          request(testServer)
            .post(`/api/projects/${PROJECT_ID_5}/embeds`)
            .send({ type: "github", url: "https://example.com/x" }),
      ],
      [
        "POST review",
        () => request(testServer).post(`/api/projects/${PROJECT_ID_5}/review`),
      ],
      [
        "POST recruiter-share",
        () => request(testServer).post(`/api/projects/${PROJECT_ID_5}/recruiter-share`),
      ],
    ] as const) {
      const res = await fn();
      expect(res.status, label).toBe(403);
      const err = String((res.body as { error?: string })?.error ?? "");
      expect(err.toLowerCase()).toMatch(/owner|ownership|forbidden|must be/);
    }
  });
});

describe("10. UI — public embeds surface", () => {
  it("renders a GitHub embed link", () => {
    render(
      React.createElement(PublicProjectEmbeds, {
        embeds: [
          {
            id: "1",
            type: "github",
            url: "https://github.com/acme/demo",
          },
        ],
      })
    );
    expect(screen.getByText(/github\.com/i)).toBeTruthy();
    trackPass("ui");
  });
});
