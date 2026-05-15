import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getClerkAppSession } from "@/lib/auth";
import { getDb } from "@/db";
import { projects, recruiterShareTokens } from "@/db/schema/projects";
import { recruiterShareDisplayUrl } from "@/lib/projectsUrls";

export const runtime = "nodejs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

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

    const { id: projectId } = await context.params;
    if (!UUID.test(projectId)) {
      return jsonErr(400, { error: "Invalid project id", code: "INVALID_ID" });
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
        error: "You must be the project owner to create a recruiter share link.",
        code: "FORBIDDEN_OWNERSHIP",
      });
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [row] = await db
      .insert(recruiterShareTokens)
      .values({
        projectId,
        token,
        expiresAt,
      })
      .returning();

    if (!row) {
      return jsonErr(500, { error: "Failed to create token", code: "INTERNAL_ERROR" });
    }

    return NextResponse.json({
      token: row.token,
      share_url: recruiterShareDisplayUrl(row.token),
      expires_at: row.expiresAt.toISOString(),
    });
  } catch (e) {
    console.error("[projects/:id/recruiter-share POST]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
