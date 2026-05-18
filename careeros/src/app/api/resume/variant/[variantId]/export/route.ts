import { generateAndUploadExports } from "@/lib/resume/exporter";
import {
  getVariantOwnedByUser,
  isExportFormat,
  jsonError,
  jsonResponse,
  requireResumeAuth,
} from "@/lib/resume/routeHelpers";

export const runtime = "nodejs";

type ExportBody = {
  format?: string;
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

    let body: ExportBody;
    try {
      body = (await req.json()) as ExportBody;
    } catch {
      return jsonError(400, { error: "Invalid JSON body" });
    }

    if (!isExportFormat(body.format)) {
      return jsonError(422, { error: "Invalid export format" });
    }

    const { variant } = owned;
    const exports = await generateAndUploadExports(
      variantId,
      variant.generatedContent,
      variant.atsScore
    );

    if (body.format === "pdf") {
      return jsonResponse({ pdfUrl: exports.pdfUrl });
    }
    if (body.format === "docx") {
      return jsonResponse({ docxUrl: exports.docxUrl });
    }

    return jsonResponse({
      pdfUrl: exports.pdfUrl,
      docxUrl: exports.docxUrl,
    });
  } catch (error) {
    console.error("[resume/variant/export] POST:", error);
    return jsonError(500, { error: "Unexpected server error" });
  }
}
