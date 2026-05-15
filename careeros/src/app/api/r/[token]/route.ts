import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { projectEmbeds, projects, recruiterShareTokens } from "@/db/schema/projects";
import { toEmbedJson, sanitizeAiReviewerDataForClient } from "@/lib/projectsApiShared";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const db = getDb();

    const [row] = await db
      .select()
      .from(recruiterShareTokens)
      .where(eq(recruiterShareTokens.token, token))
      .limit(1);

    if (!row || row.isRevoked) {
      return jsonErr(404, { error: "Link invalid or expired", code: "NOT_FOUND" });
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      return jsonErr(404, { error: "Link invalid or expired", code: "NOT_FOUND" });
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, row.projectId))
      .limit(1);

    if (!project || project.isDeleted) {
      return jsonErr(404, { error: "Project not found", code: "NOT_FOUND" });
    }

    if (!row.accessedAt) {
      await db
        .update(recruiterShareTokens)
        .set({ accessedAt: new Date() })
        .where(eq(recruiterShareTokens.id, row.id));
    }

    const embeds = await db
      .select()
      .from(projectEmbeds)
      .where(eq(projectEmbeds.projectId, project.id))
      .orderBy(asc(projectEmbeds.displayOrder), asc(projectEmbeds.createdAt));

    return NextResponse.json({
      my_role: project.myRole,
      role: project.myRole,
      outcome: project.outcome,
      ai_stack: project.aiStack,
      ai_reviewer_data: sanitizeAiReviewerDataForClient(project.aiReviewerData),
      embeds: embeds.map(toEmbedJson),
    });
  } catch (e) {
    console.error("[r/:token GET]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
