import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { resumeVersions } from "@/db/schema/resume";
import {
  checkResumeApiRateLimit,
  checkResumeUploadRateLimit,
  rateLimitResponse,
} from "@/lib/rateLimit";
import { parseResume, uploadResume } from "@/lib/resume/parser";
import {
  isTargetRole,
  jsonError,
  jsonResponse,
  requireResumeAuth,
} from "@/lib/resume/routeHelpers";
import {
  ResumeParseError,
  ResumeUploadError,
} from "@/lib/resume/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authResult = await requireResumeAuth({ skipApiRateLimit: true });
    if (!authResult.ok) return authResult.response;
    const { appUser } = authResult.auth;

    const [uploadRate, apiRate] = await Promise.all([
      checkResumeUploadRateLimit(appUser.id),
      checkResumeApiRateLimit(appUser.id),
    ]);
    if (!uploadRate.allowed || !apiRate.allowed) {
      return rateLimitResponse();
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return jsonError(400, { error: "Expected multipart/form-data" });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const formUserId = formData.get("userId");
    const targetRoleRaw = formData.get("targetRole");

    if (!(file instanceof File)) {
      return jsonError(400, { error: "Missing resume file" });
    }

    const userId =
      typeof formUserId === "string" && formUserId.trim()
        ? formUserId.trim()
        : appUser.id;

    if (userId !== appUser.id) {
      return jsonError(403, { error: "userId does not match authenticated user" });
    }

    if (!isTargetRole(targetRoleRaw)) {
      return jsonError(422, { error: "Invalid target role" });
    }

    const resumeRow = await uploadResume(file, userId);
    const parsedData = await parseResume(resumeRow.storageKey, resumeRow.fileType);

    const db = getDb();
    const [maxRow] = await db
      .select({
        maxVersion: sql<number>`coalesce(max(${resumeVersions.versionNumber}), 0)`,
      })
      .from(resumeVersions)
      .where(eq(resumeVersions.resumeId, resumeRow.id));

    const versionNumber = (maxRow?.maxVersion ?? 0) + 1;

    const [versionRow] = await db
      .insert(resumeVersions)
      .values({
        resumeId: resumeRow.id,
        versionNumber,
        parsedData,
        targetRole: targetRoleRaw,
      })
      .returning();

    if (!versionRow) {
      return jsonError(500, { error: "Failed to save resume version" });
    }

    return jsonResponse({
      resumeId: resumeRow.id,
      versionId: versionRow.id,
      parsedData,
    });
  } catch (error) {
    if (error instanceof ResumeUploadError) {
      return jsonError(400, { error: error.message });
    }
    if (error instanceof ResumeParseError) {
      return jsonError(422, { error: error.message });
    }
    console.error("[resume/upload] POST:", error);
    return jsonError(500, { error: "Unexpected server error" });
  }
}
