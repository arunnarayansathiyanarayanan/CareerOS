import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  resumeVariants,
  resumeVersions,
  resumes,
} from "@/db/schema/resume";
import { deleteR2Objects } from "@/lib/resume/r2Delete";
import {
  getResumeOwnedByUser,
  jsonError,
  jsonResponse,
  requireResumeAuth,
} from "@/lib/resume/routeHelpers";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ resumeId: string }> }
) {
  try {
    const authResult = await requireResumeAuth();
    if (!authResult.ok) return authResult.response;
    const { appUser } = authResult.auth;

    const { resumeId } = await context.params;
    const resume = await getResumeOwnedByUser(resumeId, appUser.id);
    if (!resume) {
      return jsonError(404, { error: "Resume not found" });
    }

    const db = getDb();

    const exportRows = await db
      .select({
        pdfStorageKey: resumeVariants.pdfStorageKey,
        docxStorageKey: resumeVariants.docxStorageKey,
      })
      .from(resumeVariants)
      .innerJoin(
        resumeVersions,
        eq(resumeVariants.resumeVersionId, resumeVersions.id)
      )
      .where(eq(resumeVersions.resumeId, resumeId));

    const keysToDelete = [
      resume.storageKey,
      ...exportRows.flatMap((row) =>
        [row.pdfStorageKey, row.docxStorageKey].filter(
          (key): key is string => typeof key === "string" && key.length > 0
        )
      ),
    ];

    await db
      .update(resumes)
      .set({ deletedAt: new Date() })
      .where(eq(resumes.id, resumeId));

    try {
      await deleteR2Objects(keysToDelete);
    } catch (storageError) {
      console.error("[resume/delete] R2 cleanup failed:", storageError);
    }

    return jsonResponse({ success: true as const });
  } catch (error) {
    console.error("[resume/delete] DELETE:", error);
    return jsonError(500, { error: "Unexpected server error" });
  }
}
