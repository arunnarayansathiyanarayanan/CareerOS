import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getClerkAppSession } from "@/lib/auth";
import { getDb } from "@/db";
import { projectEmbeds, projects } from "@/db/schema/projects";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { PROJECT_EMBEDS_BUCKET } from "@/lib/projectsApiShared";

export const runtime = "nodejs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string; embedId: string }> };

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function DELETE(_req: Request, context: RouteContext) {
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

    const { id: projectId, embedId } = await context.params;
    if (!UUID.test(projectId) || !UUID.test(embedId)) {
      return jsonErr(400, { error: "Invalid id", code: "INVALID_ID" });
    }

    const db = getDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || project.isDeleted) {
      return jsonErr(404, { error: "Project not found", code: "NOT_FOUND" });
    }
    if (project.userId !== appUser.id) {
      return jsonErr(403, {
        error: "You must be the project owner to manage embeds.",
        code: "FORBIDDEN_OWNERSHIP",
      });
    }

    const [embed] = await db
      .select()
      .from(projectEmbeds)
      .where(and(eq(projectEmbeds.id, embedId), eq(projectEmbeds.projectId, projectId)))
      .limit(1);

    if (!embed) {
      return jsonErr(404, { error: "Embed not found", code: "NOT_FOUND" });
    }

    await db.delete(projectEmbeds).where(eq(projectEmbeds.id, embedId));

    if (embed.storageKey) {
      const supabase = getSupabaseAdmin();
      await supabase.storage.from(PROJECT_EMBEDS_BUCKET).remove([embed.storageKey]);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[projects/:id/embeds/:embedId DELETE]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
