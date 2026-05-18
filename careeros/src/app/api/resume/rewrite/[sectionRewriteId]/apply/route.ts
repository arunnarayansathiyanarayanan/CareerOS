import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import {
  resumeSectionRewrites,
  resumeVariants,
  resumeVersions,
  resumes,
} from "@/db/schema/resume";
import { applyRewrite } from "@/lib/resume/sectionRewriter";
import {
  jsonError,
  jsonResponse,
  requireResumeAuth,
} from "@/lib/resume/routeHelpers";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  context: { params: Promise<{ sectionRewriteId: string }> }
) {
  try {
    const authResult = await requireResumeAuth();
    if (!authResult.ok) return authResult.response;
    const { appUser } = authResult.auth;

    const { sectionRewriteId } = await context.params;

    const db = getDb();
    const [owned] = await db
      .select({ id: resumeSectionRewrites.id })
      .from(resumeSectionRewrites)
      .innerJoin(
        resumeVariants,
        eq(resumeSectionRewrites.variantId, resumeVariants.id)
      )
      .innerJoin(
        resumeVersions,
        eq(resumeVariants.resumeVersionId, resumeVersions.id)
      )
      .innerJoin(resumes, eq(resumeVersions.resumeId, resumes.id))
      .where(
        and(
          eq(resumeSectionRewrites.id, sectionRewriteId),
          eq(resumes.userId, appUser.id),
          isNull(resumes.deletedAt)
        )
      )
      .limit(1);

    if (!owned) {
      return jsonError(404, { error: "Rewrite not found" });
    }

    try {
      await applyRewrite(sectionRewriteId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Rewrite not found";
      if (message.includes("not found")) {
        return jsonError(404, { error: "Rewrite not found" });
      }
      throw error;
    }

    return jsonResponse({ success: true as const });
  } catch (error) {
    console.error("[resume/rewrite/apply] POST:", error);
    return jsonError(500, { error: "Unexpected server error" });
  }
}
