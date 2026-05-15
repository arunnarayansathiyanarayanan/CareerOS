import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getClerkAppSession } from "@/lib/auth";
import { getDb } from "@/db";
import { projectEmbeds, projects } from "@/db/schema/projects";
import {
  ReviewParseError,
  reviewProject,
  saveProjectAiReviewResult,
} from "@/lib/ai/project-reviewer";
import { toEmbedJson, projectEmbedHasEvidence } from "@/lib/projectsApiShared";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const uuidSchema = z.string().uuid();

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(_req: Request, context: RouteContext) {
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

    const { id } = await context.params;
    if (!uuidSchema.safeParse(id).success) {
      return jsonErr(400, { error: "Invalid project id", code: "INVALID_ID" });
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return jsonErr(503, {
        error: "AI review is not configured (missing OPENAI_API_KEY).",
        code: "AI_UNAVAILABLE",
      });
    }

    const db = getDb();
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.isDeleted, false)))
      .limit(1);

    if (!row) {
      return jsonErr(404, { error: "Project not found", code: "NOT_FOUND" });
    }
    if (row.userId !== appUser.id) {
      return jsonErr(403, {
        error: "You must be the project owner to run AI review.",
        code: "FORBIDDEN_OWNERSHIP",
      });
    }

    if (row.aiReviewerCallCount >= 3) {
      return jsonErr(429, {
        error:
          "This project has reached the maximum of 3 AI reviews. Changing the AI stack resets the reviewer so you can run it again.",
        code: "REVIEW_RATE_LIMIT",
      });
    }

    const embedRows = await db
      .select()
      .from(projectEmbeds)
      .where(eq(projectEmbeds.projectId, id))
      .orderBy(asc(projectEmbeds.displayOrder), asc(projectEmbeds.createdAt));

    const evidenceEmbeds = embedRows.filter((e) =>
      projectEmbedHasEvidence({
        url: e.url,
        storageKey: e.storageKey,
      })
    );
    if (evidenceEmbeds.length === 0) {
      return jsonErr(422, {
        error:
          "Add at least one embed—a repo link, demo URL, Loom, screenshot, or PDF—before running AI review. Feedback is grounded in proof of work, not the text fields alone.",
        code: "EMBEDS_REQUIRED",
      });
    }

    const input = {
      title: row.title,
      one_liner: row.oneLiner,
      problem_solved: row.problemSolved,
      ai_stack: row.aiStack,
      my_role: row.myRole,
      outcome: row.outcome,
      embeds: evidenceEmbeds.map((e) => {
        const j = toEmbedJson(e);
        return { type: j.type, url: j.url ?? undefined };
      }),
    };

    let result;
    try {
      result = await reviewProject(input);
    } catch (e) {
      if (e instanceof ReviewParseError) {
        console.error("[projects/:id/review POST] parse/review failure", e);
        return jsonErr(502, {
          error: "AI review produced an unreadable response. Please try again.",
          code: "AI_REVIEW_PARSE_ERROR",
        });
      }
      console.error("[projects/:id/review POST]", e);
      return jsonErr(502, {
        error: "AI review failed. Please try again later.",
        code: "AI_REVIEW_FAILED",
      });
    }

    await saveProjectAiReviewResult(id, result);

    return NextResponse.json(result);
  } catch (e) {
    console.error("[projects/:id/review POST]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
