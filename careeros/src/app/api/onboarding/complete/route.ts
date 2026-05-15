import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";
import { z } from "zod";

import { setOnboardingGateCookie } from "@/lib/onboardingMiddlewareCache";
import { sendWelcomeEmail } from "@/services/notifications";

import {
  generateInitialRoadmap,
  type ResumeParsed,
} from "@/services/roadmapGenerator";

export const runtime = "nodejs";

const completeBodySchema = z.object({
  targetRole: z.enum([
    "ai_product_manager",
    "ai_generalist",
    "ai_engineer",
    "ai_marketer",
    "ai_operator",
    "ai_native_founder",
    "other",
  ]),
  currentRole: z.string().max(100).optional(),
  yearsOfExperience: z.enum(["0-1", "1-3", "3-7", "7-12", "12+"]),
  aiFluency: z.enum([
    "not_started",
    "played_with_chatgpt",
    "built_workflows",
    "shipped_projects",
    "working_in_ai",
  ]),
  resumeUrl: z.string().url().optional(),
  resumeParsed: z.any().optional(),
  referralSource: z.string().optional(),
  utmParams: z.record(z.string(), z.string()).optional(),
});

type CompleteBody = z.infer<typeof completeBodySchema>;

function jsonError(
  status: number,
  error: string,
  code: string,
  details?: unknown
): NextResponse<{ error: string; code: string; details?: unknown }> {
  const body: { error: string; code: string; details?: unknown } = {
    error,
    code,
  };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
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

function roadmapRoutingRole(targetRole: CompleteBody["targetRole"]): string {
  return targetRole === "other" ? "ai_generalist" : targetRole;
}

function asResumeParsed(raw: unknown): ResumeParsed | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as ResumeParsed;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return jsonError(401, "Authentication required", "UNAUTHORIZED");
    }

    const clerkUser = await currentUser();
    const primaryEmail =
      clerkUser?.primaryEmailAddress?.emailAddress ??
      clerkUser?.emailAddresses?.[0]?.emailAddress;
    if (!primaryEmail) {
      return jsonError(
        422,
        "A verified email is required to complete onboarding",
        "MISSING_EMAIL"
      );
    }

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body", "INVALID_JSON");
    }

    const parsed = completeBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return jsonError(400, "Validation failed", "VALIDATION_ERROR", parsed.error.flatten());
    }
    const body = parsed.data;

    const supabase = getSupabaseAdmin();
    const routingRole = roadmapRoutingRole(body.targetRole);

    const { data: userRow, error: userUpsertError } = await supabase
      .from("users")
      .upsert(
        {
          clerk_id: userId,
          email: primaryEmail,
          username: clerkUser?.username ?? null,
        },
        { onConflict: "clerk_id" }
      )
      .select("id")
      .single();

    if (userUpsertError || !userRow) {
      console.error("[onboarding/complete] users upsert:", userUpsertError);
      return jsonError(502, "Failed to sync user", "USER_SYNC_FAILED");
    }

    const internalUserId = userRow.id as string;

    const { data: existingProfiles, error: profileSelectError } = await supabase
      .from("onboarding_profiles")
      .select("id")
      .eq("user_id", internalUserId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (profileSelectError) {
      console.error("[onboarding/complete] profile lookup:", profileSelectError);
      return jsonError(502, "Failed to load profile", "DATABASE_ERROR");
    }

    const existingId = existingProfiles?.[0]?.id as string | undefined;

    const profilePayload = {
      user_id: internalUserId,
      target_role: body.targetRole,
      current_role: body.currentRole ?? null,
      years_of_experience: body.yearsOfExperience,
      ai_fluency: body.aiFluency,
      resume_url: body.resumeUrl ?? null,
      resume_parsed: body.resumeParsed ?? null,
      referral_source: body.referralSource ?? null,
      referral_utm: body.utmParams ?? null,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let profileId: string;

    if (existingId) {
      const { data: updated, error: updateError } = await supabase
        .from("onboarding_profiles")
        .update(profilePayload)
        .eq("id", existingId)
        .select("id")
        .single();

      if (updateError || !updated) {
        console.error("[onboarding/complete] profile update:", updateError);
        return jsonError(502, "Failed to update profile", "PROFILE_UPDATE_FAILED");
      }
      profileId = updated.id as string;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("onboarding_profiles")
        .insert(profilePayload)
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.error("[onboarding/complete] profile insert:", insertError);
        return jsonError(502, "Failed to create profile", "PROFILE_INSERT_FAILED");
      }
      profileId = inserted.id as string;
    }

    let roadmapId: string;
    try {
      const roadmap = await generateInitialRoadmap({
        userId: internalUserId,
        onboardingProfileId: profileId,
        targetRole: routingRole,
        currentRole: body.currentRole ?? null,
        yearsOfExperience: body.yearsOfExperience,
        aiFluency: body.aiFluency,
        resumeParsed: asResumeParsed(body.resumeParsed),
      });
      roadmapId = roadmap.id;
    } catch (e) {
      console.error("[onboarding/complete] roadmap generation:", e);
      return jsonError(502, "Failed to save roadmap", "ROADMAP_GENERATION_FAILED");
    }

    const displayName =
      clerkUser?.firstName?.trim() ||
      (clerkUser?.username ? String(clerkUser.username) : "there");

    after(() =>
      sendWelcomeEmail(
        {
          email: primaryEmail,
          name: displayName,
          targetRole: body.targetRole,
          publicProfileSlug: clerkUser?.username ?? null,
        },
        roadmapId
      )
    );

    const res = NextResponse.json({
      success: true,
      profileId,
      roadmapId,
    });
    setOnboardingGateCookie(res, { complete: true, lastStep: 1 });
    return res;
  } catch (e) {
    console.error("[onboarding/complete] unexpected:", e);
    return jsonError(500, "Unexpected server error", "INTERNAL_ERROR");
  }
}
