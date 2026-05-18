import { and, eq, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { autoTagSkills } from "@/lib/ai/skill-tagger";
import { getClerkAppSession } from "@/lib/auth";
import { ensureAppUserPublicUsername } from "@/lib/ensureAppUserPublicUsername";
import { isSkillOntologyValue } from "@/lib/constants/skillOntology";
import { getDb } from "@/db";
import {
  type Project,
  projectPublishRateLimit,
  projectTemplates,
  projects,
} from "@/db/schema/projects";
import {
  MAX_PUBLISHES_PER_24H,
  PUBLISH_RATE_WINDOW_MS,
  titleToSlugBase,
  toProjectJson,
} from "@/lib/projectsApiShared";
import { projectPublicDisplayUrl } from "@/lib/projectsUrls";
import {
  maybeAutoPinFirstPublishedProject,
  syncProfileSkillGraphFromStacks,
} from "@/services/syncProfileSkillGraph";
import * as cohortService from "@/server/services/cohort.service";
import * as leaderboardService from "@/server/services/leaderboard.service";
import * as streakService from "@/server/services/streak.service";

export const runtime = "nodejs";

const createProjectBodySchema = z
  .object({
    draft_project_id: z.string().uuid().optional(),
    title: z.string().min(1).max(300),
    one_liner: z.string().min(1).max(500),
    problem_solved: z.string().min(100),
    ai_stack: z
      .array(z.string())
      .refine((arr) => arr.every(isSkillOntologyValue), {
        message: "Each ai_stack item must be listed in SKILL_ONTOLOGY",
      }),
    my_role: z.string().min(1).max(500),
    outcome: z.string().min(1).max(5000),
    privacy_mode: z.enum(["public", "unlisted", "recruiter_share"]),
    template_id: z.string().uuid().optional(),
  })
  .strict();

type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  try {
    const session = await getClerkAppSession();
    if (session.status === "signed_out") {
      return jsonErr(401, { error: "Authentication required", code: "UNAUTHORIZED" });
    }
    if (session.status === "missing_app_user") {
      return jsonErr(403, {
        error: "App user not found. Complete onboarding first.",
        code: "USER_NOT_PROVISIONED",
      });
    }
    const { appUser } = session;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(400, { error: "Invalid JSON body", code: "INVALID_JSON" });
    }

    const parsed = createProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr(422, {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        fields: parsed.error.flatten(),
      });
    }

    const username = await ensureAppUserPublicUsername({
      appUserId: appUser.id,
      clerkUserId: session.clerkUserId,
      username: appUser.username,
    });
    const data = parsed.data;
    const draftId = data.draft_project_id;

    let aiStackForInsert: CreateProjectBody["ai_stack"] = data.ai_stack;
    if (data.template_id) {
      const dbCheck = getDb();
      const [tplFull] = await dbCheck
        .select({
          id: projectTemplates.id,
          recommendedStack: projectTemplates.recommendedStack,
        })
        .from(projectTemplates)
        .where(eq(projectTemplates.id, data.template_id))
        .limit(1);
      if (!tplFull) {
        return jsonErr(400, { error: "Invalid template_id", code: "INVALID_TEMPLATE" });
      }
      const seen = new Set<string>();
      const merged: string[] = [];
      for (const s of tplFull.recommendedStack) {
        if (!seen.has(s)) {
          seen.add(s);
          merged.push(s);
        }
      }
      for (const s of data.ai_stack) {
        if (!seen.has(s)) {
          seen.add(s);
          merged.push(s);
        }
      }
      aiStackForInsert = merged as CreateProjectBody["ai_stack"];
    }

    const db = getDb();
    if (draftId) {
      const [draftCheck] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, draftId), eq(projects.isDeleted, false)))
        .limit(1);
      if (!draftCheck || draftCheck.userId !== appUser.id) {
        return jsonErr(404, { error: "Draft project not found", code: "NOT_FOUND" });
      }
      if (draftCheck.publishedAt !== null) {
        return jsonErr(409, {
          error: "This project is already published",
          code: "ALREADY_PUBLISHED",
        });
      }
    }

    const baseSlug = titleToSlugBase(data.title);
    const gate: {
      blocked?: boolean;
      project?: Project;
      badDraft?: boolean;
      alreadyPublished?: boolean;
    } = {};

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(abs(hashtext(${appUser.id}::text)))`
      );

      const now = new Date();
      const [lim] = await tx
        .select()
        .from(projectPublishRateLimit)
        .where(eq(projectPublishRateLimit.userId, appUser.id))
        .limit(1);

      let nextCount: number;
      if (!lim) {
        nextCount = 1;
      } else {
        const elapsed = now.getTime() - lim.windowStart.getTime();
        if (elapsed >= PUBLISH_RATE_WINDOW_MS) {
          nextCount = 1;
        } else if (lim.count >= MAX_PUBLISHES_PER_24H) {
          gate.blocked = true;
          return;
        } else {
          nextCount = lim.count + 1;
        }
      }

      if (gate.blocked) return;

      let slug = baseSlug;
      let suffix = 2;
      for (;;) {
        const slugConds = [
          eq(projects.username, username),
          eq(projects.slug, slug),
          eq(projects.isDeleted, false),
        ];
        if (draftId) {
          slugConds.push(ne(projects.id, draftId));
        }
        const [hit] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(and(...slugConds))
          .limit(1);
        if (!hit) break;
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      if (draftId) {
        const [existing] = await tx
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.id, draftId),
              eq(projects.isDeleted, false),
              eq(projects.userId, appUser.id)
            )
          )
          .limit(1);

        if (!existing) {
          gate.badDraft = true;
          return;
        }
        if (existing.publishedAt !== null) {
          gate.alreadyPublished = true;
          return;
        }

        const [project] = await tx
          .update(projects)
          .set({
            username,
            slug,
            title: data.title,
            oneLiner: data.one_liner,
            problemSolved: data.problem_solved,
            aiStack: aiStackForInsert,
            myRole: data.my_role,
            outcome: data.outcome,
            privacyMode: data.privacy_mode,
            templateId: data.template_id ?? null,
            publishedAt: now,
          })
          .where(eq(projects.id, draftId))
          .returning();

        if (!project) throw new Error("Update failed");
        gate.project = project;
      } else {
        const [project] = await tx
          .insert(projects)
          .values({
            userId: appUser.id,
            username,
            slug,
            title: data.title,
            oneLiner: data.one_liner,
            problemSolved: data.problem_solved,
            aiStack: aiStackForInsert,
            myRole: data.my_role,
            outcome: data.outcome,
            privacyMode: data.privacy_mode,
            templateId: data.template_id ?? null,
            publishedAt: now,
          })
          .returning();

        if (!project) throw new Error("Insert failed");
        gate.project = project;
      }

      if (!lim) {
        await tx.insert(projectPublishRateLimit).values({
          userId: appUser.id,
          windowStart: now,
          count: 1,
        });
      } else {
        const elapsed = now.getTime() - lim.windowStart.getTime();
        if (elapsed >= PUBLISH_RATE_WINDOW_MS) {
          await tx
            .update(projectPublishRateLimit)
            .set({ windowStart: now, count: 1 })
            .where(eq(projectPublishRateLimit.userId, appUser.id));
        } else {
          await tx
            .update(projectPublishRateLimit)
            .set({ count: nextCount })
            .where(eq(projectPublishRateLimit.userId, appUser.id));
        }
      }
    });

    if (gate.blocked) {
      return jsonErr(429, {
        error: "Project limit reached. Max 5 per 24 hours.",
      });
    }

    if (gate.badDraft) {
      return jsonErr(404, { error: "Draft project not found", code: "NOT_FOUND" });
    }
    if (gate.alreadyPublished) {
      return jsonErr(409, {
        error: "This project is already published",
        code: "ALREADY_PUBLISHED",
      });
    }

    if (!gate.project) {
      return jsonErr(500, { error: "Create failed", code: "INTERNAL_ERROR" });
    }

    const p = gate.project;

    const projectId = p.id;
    const stackSnapshot = aiStackForInsert;
    const titleSnapshot = data.title;
    const problemSnapshot = data.problem_solved;

    await syncProfileSkillGraphFromStacks(appUser.id, [stackSnapshot]);
    await maybeAutoPinFirstPublishedProject(
      appUser.id,
      projectId,
      data.privacy_mode
    );

    if (data.privacy_mode === "public") {
      Promise.all([
        streakService
          .recordStreakEvent(appUser.id, "PROJECT_PUBLISHED", { projectId })
          .catch((e) => console.error("streak event failed", e)),
        cohortService
          .getUserCohort(appUser.id)
          .then(({ cohort }) =>
            leaderboardService.computeUserScore(appUser.id, cohort.id),
          )
          .catch((e) => console.error("leaderboard update failed", e)),
      ]);
    }

    void (async () => {
      try {
        const tags = await autoTagSkills(
          stackSnapshot,
          titleSnapshot,
          problemSnapshot
        );
        await getDb()
          .update(projects)
          .set({ autoTags: tags })
          .where(eq(projects.id, projectId));
        await syncProfileSkillGraphFromStacks(appUser.id, [
          stackSnapshot,
          tags,
        ]);
      } catch (e) {
        console.error("[projects POST] autoTagSkills background update", e);
      }
    })();

    return NextResponse.json(
      {
        project: toProjectJson(p),
        public_url: projectPublicDisplayUrl(p.username, p.slug),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[projects POST]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
