import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { PRODUCT_DOMAIN } from "@/lib/brand";
import { getDb } from "@/db";
import { profiles } from "@/db/schema/profile";
import { projects } from "@/db/schema/projects";
import { resumeJobs, resumeVersions } from "@/db/schema/resume";
import { publicProfileUrl } from "@/lib/profileDisplay";
import { projectPublicUrl } from "@/lib/projectsUrls";
import { generateVariants } from "@/lib/resume/variantGenerator";
import {
  getVersionOwnedByUser,
  isTargetRole,
  jsonError,
  jsonResponse,
  requireResumeAuth,
} from "@/lib/resume/routeHelpers";
import type { TargetRole } from "@/lib/resume/types";

export const runtime = "nodejs";

type GenerateBody = {
  targetRole?: TargetRole;
  jobDescription?: string;
};

export async function POST(
  req: Request,
  context: { params: Promise<{ versionId: string }> }
) {
  try {
    const authResult = await requireResumeAuth();
    if (!authResult.ok) return authResult.response;
    const { appUser } = authResult.auth;

    const { versionId } = await context.params;
    const owned = await getVersionOwnedByUser(versionId, appUser.id);
    if (!owned) {
      return jsonError(404, { error: "Resume version not found" });
    }

    let body: GenerateBody;
    try {
      body = (await req.json()) as GenerateBody;
    } catch {
      return jsonError(400, { error: "Invalid JSON body" });
    }

    if (!isTargetRole(body.targetRole)) {
      return jsonError(422, { error: "Invalid target role" });
    }

    const db = getDb();

    await db
      .update(resumeVersions)
      .set({
        targetRole: body.targetRole,
        jobDescription: body.jobDescription?.trim() || null,
      })
      .where(eq(resumeVersions.id, versionId));

    const [profileRow] = await db
      .select({ username: profiles.username })
      .from(profiles)
      .where(eq(profiles.userId, appUser.id))
      .limit(1);

    const careerOsProfileUrl = profileRow?.username
      ? publicProfileUrl(profileRow.username)
      : `https://${process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "") || PRODUCT_DOMAIN}`;

    const topProjects = await db
      .select({
        username: projects.username,
        slug: projects.slug,
      })
      .from(projects)
      .where(
        and(
          eq(projects.userId, appUser.id),
          eq(projects.isDeleted, false),
          isNotNull(projects.publishedAt),
          inArray(projects.privacyMode, ["public", "unlisted"]),
          isNotNull(projects.aiReviewerScore)
        )
      )
      .orderBy(desc(projects.aiReviewerScore))
      .limit(3);

    const topProjectUrls = topProjects.map((p) =>
      projectPublicUrl(p.username, p.slug)
    );

    const [job] = await db
      .insert(resumeJobs)
      .values({
        versionId,
        status: "processing",
      })
      .returning();

    if (!job) {
      return jsonError(500, { error: "Failed to create generation job" });
    }

    const parsedResume = owned.version.parsedData;
    const jobDescription = body.jobDescription?.trim() || undefined;

    // Local dev: fire-and-forget via setImmediate. On Vercel, swap for a background function.
    setImmediate(() => {
      void (async () => {
        try {
          await generateVariants({
            parsedResume,
            resumeVersionId: versionId,
            targetRole: body.targetRole!,
            jobDescription,
            careerOsProfileUrl,
            topProjectUrls,
          });
          await db
            .update(resumeJobs)
            .set({ status: "done" })
            .where(eq(resumeJobs.id, job.id));
        } catch (error) {
          console.error("[resume/generate] background job failed:", error);
          await db
            .update(resumeJobs)
            .set({ status: "failed" })
            .where(eq(resumeJobs.id, job.id));
        }
      })();
    });

    return jsonResponse({ jobId: job.id, status: "processing" as const });
  } catch (error) {
    console.error("[resume/generate] POST:", error);
    return jsonError(500, { error: "Unexpected server error" });
  }
}
