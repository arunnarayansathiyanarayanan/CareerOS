import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { resumeVariants } from "@/db/schema/resume";
import {
  getVersionOwnedByUser,
  jsonError,
  jsonResponse,
  requireResumeAuth,
} from "@/lib/resume/routeHelpers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ versionId: string }> }
) {
  try {
    const authResult = await requireResumeAuth();
    if (!authResult.ok) return authResult.response;

    const { versionId } = await context.params;
    const owned = await getVersionOwnedByUser(
      versionId,
      authResult.auth.appUser.id
    );
    if (!owned) {
      return jsonError(404, { error: "Resume version not found" });
    }

    const db = getDb();
    const variants = await db
      .select()
      .from(resumeVariants)
      .where(eq(resumeVariants.resumeVersionId, versionId));

    return jsonResponse({
      variants,
      version: {
        id: owned.version.id,
        resumeId: owned.version.resumeId,
        targetRole: owned.version.targetRole,
        versionNumber: owned.version.versionNumber,
      },
    });
  } catch (error) {
    console.error("[resume/variants] GET:", error);
    return jsonError(500, { error: "Unexpected server error" });
  }
}
