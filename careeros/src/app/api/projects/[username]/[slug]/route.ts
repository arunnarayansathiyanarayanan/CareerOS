import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getClerkAppSession } from "@/lib/auth";
import { getDb } from "@/db";
import { projectEmbeds, projects } from "@/db/schema/projects";
import { toEmbedJson, toProjectJson } from "@/lib/projectsApiShared";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ username: string; slug: string }> };

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { username, slug } = await context.params;
    const db = getDb();

    const [project] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.username, username),
          eq(projects.slug, slug),
          eq(projects.isDeleted, false)
        )
      )
      .limit(1);

    if (!project) {
      return jsonErr(404, { error: "Project not found", code: "NOT_FOUND" });
    }

    const session = await getClerkAppSession();
    const sessionUserId =
      session.status === "authenticated" ? session.appUser.id : undefined;
    const isOwner = sessionUserId !== undefined && sessionUserId === project.userId;

    if (project.privacyMode === "public") {
      // continue
    } else if (project.privacyMode === "unlisted") {
      if (session.status !== "authenticated") {
        return jsonErr(401, { error: "Authentication required", code: "UNAUTHORIZED" });
      }
      if (!isOwner) {
        return jsonErr(403, { error: "Forbidden", code: "FORBIDDEN" });
      }
    } else if (project.privacyMode === "recruiter_share") {
      if (!isOwner) {
        if (session.status !== "authenticated") {
          return jsonErr(401, { error: "Authentication required", code: "UNAUTHORIZED" });
        }
        return jsonErr(403, { error: "Forbidden", code: "FORBIDDEN" });
      }
    }

    const embeds = await db
      .select()
      .from(projectEmbeds)
      .where(eq(projectEmbeds.projectId, project.id))
      .orderBy(asc(projectEmbeds.displayOrder), asc(projectEmbeds.createdAt));

    return NextResponse.json({
      project: toProjectJson(project),
      embeds: embeds.map(toEmbedJson),
    });
  } catch (e) {
    console.error("[projects/:username/:slug GET]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
