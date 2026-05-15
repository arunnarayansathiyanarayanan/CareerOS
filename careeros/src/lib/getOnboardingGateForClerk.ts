import { createClient } from "@supabase/supabase-js";

/**
 * Onboarding completion = `onboarding_profiles.onboarding_completed_at IS NOT NULL`
 * for the latest profile row (by `updated_at`).
 */
export async function getOnboardingGateForClerk(
  clerkId: string
): Promise<{ complete: boolean; lastStep: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { complete: false, lastStep: 1 };
  }

  const supabase = createClient(url, key);

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (userErr || !userRow || typeof userRow.id !== "string") {
    return { complete: false, lastStep: 1 };
  }

  const { data: profile, error: profErr } = await supabase
    .from("onboarding_profiles")
    .select("onboarding_completed_at, onboarding_step")
    .eq("user_id", userRow.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profErr || !profile) {
    return { complete: false, lastStep: 1 };
  }

  const lastStep =
    typeof profile.onboarding_step === "number" && profile.onboarding_step >= 1
      ? profile.onboarding_step
      : 1;

  return {
    complete: profile.onboarding_completed_at != null,
    lastStep,
  };
}
