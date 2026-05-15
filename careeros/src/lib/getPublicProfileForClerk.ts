import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles } from "@/db/schema/profile";
import { users } from "@/db/schema/users";
import { isOnboardingTargetRoleDbValue } from "@/lib/onboardingTargetRoleSpec";
import { provisionPublicProfile } from "@/services/provisionPublicProfile";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function resumeSkillsFromParsed(resumeParsed: unknown): string[] {
  if (resumeParsed === null || resumeParsed === undefined) return [];
  if (typeof resumeParsed !== "object" || Array.isArray(resumeParsed)) return [];
  const skills = (resumeParsed as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return [];
  return skills.filter((s): s is string => typeof s === "string" && s.length > 0);
}

/**
 * Returns the public profile username for nav/links. Backfills `profiles` when the
 * user claimed a username during onboarding but has no E4 row yet.
 */
export async function getPublicProfileUsernameForClerk(
  clerkId: string
): Promise<string | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return getPublicProfileUsernameViaSupabase(clerkId);
  }

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user?.username?.trim()) return null;

  const [existing] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  if (existing) return existing.username;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: onboarding } = await supabase
    .from("onboarding_profiles")
    .select("target_role, resume_parsed, onboarding_completed_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!onboarding?.onboarding_completed_at) return null;

  const targetRole =
    typeof onboarding.target_role === "string" &&
    isOnboardingTargetRoleDbValue(onboarding.target_role)
      ? onboarding.target_role
      : "ai_generalist";

  const provisioned = await provisionPublicProfile({
    userId: user.id,
    username: user.username,
    targetRole,
    skills: resumeSkillsFromParsed(onboarding.resume_parsed),
  });

  return provisioned?.username ?? null;
}

async function getPublicProfileUsernameViaSupabase(
  clerkId: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("id, username")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (!userRow?.username) return null;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", userRow.id)
    .maybeSingle();

  return (profileRow?.username as string | undefined) ?? null;
}
