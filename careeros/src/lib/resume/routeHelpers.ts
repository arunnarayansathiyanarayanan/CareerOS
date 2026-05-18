import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import {
  resumeJobs,
  resumeVariants,
  resumeVersions,
  resumes,
  targetRoleEnum,
} from "@/db/schema/resume";
import { getClerkAppSession } from "@/lib/auth";
import { checkResumeApiRateLimit } from "@/lib/rateLimit";
import type { SectionName, TargetRole } from "@/lib/resume/types";

export const VALID_TARGET_ROLES = targetRoleEnum.enumValues;
export const VALID_SECTION_NAMES = [
  "SUMMARY",
  "EXPERIENCE",
  "SKILLS",
  "PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS",
] as const satisfies readonly SectionName[];

export const EXPORT_FORMATS = ["pdf", "docx", "both"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function jsonResponse<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, { status });
}

export function jsonError(
  status: number,
  body: Record<string, unknown>
): NextResponse {
  return NextResponse.json(body, { status });
}

export function isTargetRole(value: unknown): value is TargetRole {
  return (
    typeof value === "string" &&
    (VALID_TARGET_ROLES as readonly string[]).includes(value)
  );
}

export function isSectionName(value: unknown): value is SectionName {
  return (
    typeof value === "string" &&
    (VALID_SECTION_NAMES as readonly string[]).includes(value)
  );
}

export function isExportFormat(value: unknown): value is ExportFormat {
  return (
    typeof value === "string" &&
    (EXPORT_FORMATS as readonly string[]).includes(value as ExportFormat)
  );
}

type AuthSuccess = {
  appUser: { id: string };
};

type AuthResult =
  | { ok: false; response: NextResponse }
  | { ok: true; auth: AuthSuccess };

export async function requireResumeAuth(
  options: { skipApiRateLimit?: boolean } = {}
): Promise<AuthResult> {
  const session = await getClerkAppSession();
  if (session.status === "signed_out") {
    return {
      ok: false,
      response: jsonError(401, {
        error: "Authentication required",
        code: "UNAUTHORIZED",
      }),
    };
  }
  if (session.status === "missing_app_user") {
    return {
      ok: false,
      response: jsonError(403, {
        error: "App user not found. Complete onboarding first.",
        code: "USER_NOT_PROVISIONED",
      }),
    };
  }

  if (!options.skipApiRateLimit) {
    const rate = await checkResumeApiRateLimit(session.appUser.id);
    if (!rate.allowed) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429 }
        ),
      };
    }
  }

  return { ok: true, auth: { appUser: session.appUser } };
}

export async function getResumeOwnedByUser(
  resumeId: string,
  userId: string
) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(resumes)
    .where(
      and(
        eq(resumes.id, resumeId),
        eq(resumes.userId, userId),
        isNull(resumes.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getVersionOwnedByUser(
  versionId: string,
  userId: string
) {
  const db = getDb();
  const [row] = await db
    .select({
      version: resumeVersions,
      resume: resumes,
    })
    .from(resumeVersions)
    .innerJoin(resumes, eq(resumeVersions.resumeId, resumes.id))
    .where(
      and(
        eq(resumeVersions.id, versionId),
        eq(resumes.userId, userId),
        isNull(resumes.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getVariantOwnedByUser(
  variantId: string,
  userId: string
) {
  const db = getDb();
  const [row] = await db
    .select({
      variant: resumeVariants,
      version: resumeVersions,
      resume: resumes,
    })
    .from(resumeVariants)
    .innerJoin(
      resumeVersions,
      eq(resumeVariants.resumeVersionId, resumeVersions.id)
    )
    .innerJoin(resumes, eq(resumeVersions.resumeId, resumes.id))
    .where(
      and(
        eq(resumeVariants.id, variantId),
        eq(resumes.userId, userId),
        isNull(resumes.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getJobOwnedByUser(jobId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      job: resumeJobs,
      version: resumeVersions,
      resume: resumes,
    })
    .from(resumeJobs)
    .innerJoin(resumeVersions, eq(resumeJobs.versionId, resumeVersions.id))
    .innerJoin(resumes, eq(resumeVersions.resumeId, resumes.id))
    .where(
      and(
        eq(resumeJobs.id, jobId),
        eq(resumes.userId, userId),
        isNull(resumes.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}
