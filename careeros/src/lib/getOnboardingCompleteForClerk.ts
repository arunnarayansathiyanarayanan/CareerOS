import { createClient } from "@supabase/supabase-js";

/**
 * True when Supabase has an onboarding profile with a completion timestamp
 * for this Clerk user. Used on `/` to avoid showing the starter template or
 * sending finished users back into the funnel.
 */
export async function getOnboardingCompleteForClerk(
  clerkId: string
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return false;
  }

  const supabase = createClient(url, key);

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (userErr || !userRow || typeof userRow.id !== "string") {
    return false;
  }

  const { data: profile, error: profErr } = await supabase
    .from("onboarding_profiles")
    .select("onboarding_completed_at")
    .eq("user_id", userRow.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profErr || !profile) {
    return false;
  }

  return profile.onboarding_completed_at != null;
}
