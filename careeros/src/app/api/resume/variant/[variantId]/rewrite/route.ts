import { rewriteSection } from "@/lib/resume/sectionRewriter";
import {
  getVariantOwnedByUser,
  isSectionName,
  jsonError,
  jsonResponse,
  requireResumeAuth,
} from "@/lib/resume/routeHelpers";
import type { SectionName } from "@/lib/resume/types";

export const runtime = "nodejs";

type RewriteBody = {
  sectionName?: SectionName;
  originalText?: string;
  userInstruction?: string;
};

export async function POST(
  req: Request,
  context: { params: Promise<{ variantId: string }> }
) {
  try {
    const authResult = await requireResumeAuth();
    if (!authResult.ok) return authResult.response;
    const { appUser } = authResult.auth;

    const { variantId } = await context.params;
    const owned = await getVariantOwnedByUser(variantId, appUser.id);
    if (!owned) {
      return jsonError(404, { error: "Resume variant not found" });
    }

    let body: RewriteBody;
    try {
      body = (await req.json()) as RewriteBody;
    } catch {
      return jsonError(400, { error: "Invalid JSON body" });
    }

    if (!isSectionName(body.sectionName)) {
      return jsonError(422, { error: "Invalid section name" });
    }

    if (typeof body.originalText !== "string" || !body.originalText.trim()) {
      return jsonError(422, { error: "originalText is required" });
    }

    const result = await rewriteSection({
      variantId,
      sectionName: body.sectionName,
      originalText: body.originalText,
      userInstruction: body.userInstruction,
      targetRole: owned.version.targetRole,
      jobDescription: owned.version.jobDescription ?? undefined,
    });

    return jsonResponse({
      sectionRewriteId: result.sectionRewriteId,
      rewrittenText: result.rewrittenText,
      diffHunks: result.diffHunks,
    });
  } catch (error) {
    console.error("[resume/variant/rewrite] POST:", error);
    return jsonError(500, { error: "Unexpected server error" });
  }
}
