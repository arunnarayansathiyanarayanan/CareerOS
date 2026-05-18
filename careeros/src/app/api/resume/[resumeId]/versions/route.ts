import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { resumeVersions } from "@/db/schema/resume";
import {
  getResumeOwnedByUser,
  jsonError,
  jsonResponse,
  requireResumeAuth,
} from "@/lib/resume/routeHelpers";

export const runtime = "nodejs";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET(
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
    const rows = await db
      .select()
      .from(resumeVersions)
      .where(eq(resumeVersions.resumeId, resumeId))
      .orderBy(desc(resumeVersions.versionNumber));

    const cutoff = Date.now() - NINETY_DAYS_MS;
    const versions = rows.map((row) => {
      const createdAtMs = row.createdAt.getTime();
      if (createdAtMs < cutoff) {
        return {
          id: row.id,
          versionNumber: row.versionNumber,
          createdAt: row.createdAt,
          expired: true as const,
        };
      }
      return row;
    });

    return jsonResponse({ versions });
  } catch (error) {
    console.error("[resume/versions] GET:", error);
    return jsonError(500, { error: "Unexpected server error" });
  }
}
