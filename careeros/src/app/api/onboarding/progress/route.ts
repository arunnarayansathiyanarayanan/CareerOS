import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const TARGET_ROLES = [
  "ai_product_manager",
  "ai_generalist",
  "ai_engineer",
  "ai_marketer",
  "ai_operator",
  "ai_native_founder",
  "other",
] as const;

const YEARS_OF_EXPERIENCE = ["0-1", "1-3", "3-7", "7-12", "12+"] as const;

const AI_FLUENCY = [
  "not_started",
  "played_with_chatgpt",
  "built_workflows",
  "shipped_projects",
  "working_in_ai",
] as const;

export type TargetRole = (typeof TARGET_ROLES)[number];
export type YearsOfExperience = (typeof YEARS_OF_EXPERIENCE)[number];
export type AiFluency = (typeof AI_FLUENCY)[number];

export interface OnboardingProfile {
  step: number;
  targetRole: TargetRole | null;
  currentRole: string | null;
  yearsOfExperience: YearsOfExperience | null;
  aiFluency: AiFluency | null;
  resumeText: string | null;
  resumeUrl: string | null;
  resumeParsed: Record<string, unknown> | null;
  referralSource: string | null;
  utmParams: Record<string, string>;
  onboardingCompletedAt: string | null;
}

function jsonError(
  status: number,
  error: string,
  code: string
): NextResponse<{ error: string; code: string }> {
  return NextResponse.json({ error, code }, { status });
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key);
}

type OnboardingRow = {
  id: string;
  user_id: string | null;
  target_role: string;
  current_role: string | null;
  years_of_experience: string | null;
  ai_fluency: string | null;
  resume_text: string | null;
  resume_url: string | null;
  resume_parsed: Record<string, unknown> | null;
  onboarding_completed_at: string | null;
  onboarding_step: number | null;
  referral_source: string | null;
  referral_utm: unknown;
};

function isTargetRole(v: string): v is TargetRole {
  return (TARGET_ROLES as readonly string[]).includes(v);
}

function isYearsOfExperience(v: string): v is YearsOfExperience {
  return (YEARS_OF_EXPERIENCE as readonly string[]).includes(v);
}

function isAiFluency(v: string): v is AiFluency {
  return (AI_FLUENCY as readonly string[]).includes(v);
}

function asUtmParams(raw: unknown): Record<string, string> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function rowToProfile(row: OnboardingRow): OnboardingProfile {
  const tr = row.target_role;
  return {
    step: row.onboarding_step ?? 1,
    targetRole: isTargetRole(tr) ? tr : null,
    currentRole: row.current_role,
    yearsOfExperience:
      row.years_of_experience && isYearsOfExperience(row.years_of_experience)
        ? row.years_of_experience
        : null,
    aiFluency:
      row.ai_fluency && isAiFluency(row.ai_fluency) ? row.ai_fluency : null,
    resumeText: row.resume_text,
    resumeUrl: row.resume_url,
    resumeParsed: row.resume_parsed,
    referralSource: row.referral_source,
    utmParams: asUtmParams(row.referral_utm),
    onboardingCompletedAt: row.onboarding_completed_at,
  };
}

const partialProfileSchema = z
  .object({
    targetRole: z.enum(TARGET_ROLES).nullable().optional(),
    currentRole: z.string().nullable().optional(),
    yearsOfExperience: z.enum(YEARS_OF_EXPERIENCE).nullable().optional(),
    aiFluency: z.enum(AI_FLUENCY).nullable().optional(),
    resumeText: z.string().nullable().optional(),
    resumeUrl: z.string().nullable().optional(),
    resumeParsed: z.record(z.string(), z.unknown()).nullable().optional(),
    referralSource: z.string().nullable().optional(),
    utmParams: z.record(z.string(), z.string()).optional(),
    onboardingCompletedAt: z.string().nullable().optional(),
  })
  .strict();

const patchBodySchema = z.object({
  step: z.number().int().min(1),
  data: partialProfileSchema.default({}),
});

function partialToRowUpdate(
  data: z.infer<typeof partialProfileSchema>
): Partial<OnboardingRow> {
  const row: Partial<OnboardingRow> = {};
  if (data.targetRole !== undefined && data.targetRole !== null) {
    row.target_role = data.targetRole;
  }
  if (data.currentRole !== undefined) row.current_role = data.currentRole;
  if (data.yearsOfExperience !== undefined) {
    row.years_of_experience = data.yearsOfExperience;
  }
  if (data.aiFluency !== undefined) row.ai_fluency = data.aiFluency;
  if (data.resumeText !== undefined) row.resume_text = data.resumeText;
  if (data.resumeUrl !== undefined) row.resume_url = data.resumeUrl;
  if (data.resumeParsed !== undefined) row.resume_parsed = data.resumeParsed;
  if (data.referralSource !== undefined) {
    row.referral_source = data.referralSource;
  }
  if (data.utmParams !== undefined) row.referral_utm = data.utmParams;
  if (data.onboardingCompletedAt !== undefined) {
    row.onboarding_completed_at = data.onboardingCompletedAt;
  }
  return row;
}

async function getUserIdByClerk(
  supabase: SupabaseClient,
  clerkId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

async function ensureAppUser(
  supabase: SupabaseClient,
  clerkId: string,
  email: string,
  username: string | null
): Promise<string> {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      { clerk_id: clerkId, email, username },
      { onConflict: "clerk_id" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function getLatestProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingRow | null> {
  const { data, error } = await supabase
    .from("onboarding_profiles")
    .select(
      "id, user_id, target_role, current_role, years_of_experience, ai_fluency, resume_text, resume_url, resume_parsed, onboarding_completed_at, onboarding_step, referral_source, referral_utm"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as OnboardingRow | null;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return jsonError(401, "Authentication required", "UNAUTHORIZED");
    }

    const supabase = getSupabaseAdmin();
    const appUserId = await getUserIdByClerk(supabase, userId);
    if (!appUserId) {
      return NextResponse.json({ profile: null });
    }

    const row = await getLatestProfile(supabase, appUserId);

    return NextResponse.json({
      profile: row ? rowToProfile(row) : null,
    });
  } catch (e) {
    console.error("[onboarding/progress] GET:", e);
    return jsonError(500, "Unexpected server error", "INTERNAL_ERROR");
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return jsonError(401, "Authentication required", "UNAUTHORIZED");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body", "INVALID_JSON");
    }

    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "Invalid request body", "VALIDATION_ERROR");
    }

    const { step, data } = parsed.data;
    const rowPatch = partialToRowUpdate(data);
    const now = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    let appUserId = await getUserIdByClerk(supabase, userId);
    if (!appUserId) {
      const clerkUser = await currentUser();
      const primaryEmail =
        clerkUser?.primaryEmailAddress?.emailAddress ??
        clerkUser?.emailAddresses?.[0]?.emailAddress;
      if (!primaryEmail) {
        return jsonError(
          422,
          "A verified email is required to start saving onboarding progress",
          "MISSING_EMAIL"
        );
      }
      appUserId = await ensureAppUser(
        supabase,
        userId,
        primaryEmail,
        clerkUser?.username ?? null
      );
    }

    const existing = await getLatestProfile(supabase, appUserId);

    if (existing) {
      const { error } = await supabase
        .from("onboarding_profiles")
        .update({
          ...rowPatch,
          onboarding_step: step,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (error) {
        console.error("[onboarding/progress] PATCH update:", error);
        return jsonError(502, "Failed to save progress", "DATABASE_ERROR");
      }
    } else {
      const insertTarget =
        rowPatch.target_role !== undefined
          ? rowPatch.target_role
          : "other";

      const { error } = await supabase.from("onboarding_profiles").insert({
        user_id: appUserId,
        onboarding_step: step,
        target_role: insertTarget,
        current_role: rowPatch.current_role ?? null,
        years_of_experience: rowPatch.years_of_experience ?? null,
        ai_fluency: rowPatch.ai_fluency ?? null,
        resume_text: rowPatch.resume_text ?? null,
        resume_url: rowPatch.resume_url ?? null,
        resume_parsed: rowPatch.resume_parsed ?? null,
        referral_source: rowPatch.referral_source ?? null,
        referral_utm: rowPatch.referral_utm ?? {},
        onboarding_completed_at: rowPatch.onboarding_completed_at ?? null,
        updated_at: now,
      });

      if (error) {
        console.error("[onboarding/progress] PATCH insert:", error);
        return jsonError(502, "Failed to save progress", "DATABASE_ERROR");
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[onboarding/progress] PATCH:", e);
    return jsonError(500, "Unexpected server error", "INTERNAL_ERROR");
  }
}
