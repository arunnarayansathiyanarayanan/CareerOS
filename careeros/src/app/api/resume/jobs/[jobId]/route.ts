import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { resumeVariants } from "@/db/schema/resume";
import {
  getJobOwnedByUser,
  jsonError,
  jsonResponse,
  requireResumeAuth,
} from "@/lib/resume/routeHelpers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const authResult = await requireResumeAuth();
    if (!authResult.ok) return authResult.response;
    const { appUser } = authResult.auth;

    const { jobId } = await context.params;
    const owned = await getJobOwnedByUser(jobId, appUser.id);
    if (!owned) {
      return jsonError(404, { error: "Job not found" });
    }

    const { job } = owned;

    if (job.status !== "done") {
      return jsonResponse({ status: job.status });
    }

    const db = getDb();
    const variants = await db
      .select()
      .from(resumeVariants)
      .where(eq(resumeVariants.resumeVersionId, job.versionId));

    return jsonResponse({ status: job.status, variants });
  } catch (error) {
    console.error("[resume/jobs] GET:", error);
    return jsonError(500, { error: "Unexpected server error" });
  }
}
