import { targetRoleFromOnboardingSelection } from "@/lib/mapOnboardingTargetRole";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { TargetRole } from "@/types/roadmap";

/** Latest onboarding `target_role` for roadmap generation fallbacks. */
export async function getOnboardingTargetRoleForClerk(
  clerkId: string
): Promise<TargetRole> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .maybeSingle();

    if (!userRow || typeof userRow.id !== "string") {
      return "AI_GENERALIST";
    }

    const { data: profile } = await supabase
      .from("onboarding_profiles")
      .select("target_role")
      .eq("user_id", userRow.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return targetRoleFromOnboardingSelection(
      profile?.target_role as string | undefined
    );
  } catch {
    return "AI_GENERALIST";
  }
}
