import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FREE_TIER_WEEKLY_SESSION_LIMIT,
  getNextMondayResetIso,
  getWeeklySessionsUsed,
} from "@/lib/interviews/quota";

export type QuotaCheckResult =
  | { allowed: true }
  | { allowed: false; resetAt: string; sessionsUsed: number };

export async function checkInterviewQuota(
  userId: string,
  supabase: SupabaseClient,
  isPro: boolean
): Promise<QuotaCheckResult> {
  if (isPro) {
    return { allowed: true };
  }

  const sessionsUsed = await getWeeklySessionsUsed(supabase, userId);

  if (sessionsUsed < FREE_TIER_WEEKLY_SESSION_LIMIT) {
    return { allowed: true };
  }

  return {
    allowed: false,
    resetAt: getNextMondayResetIso(),
    sessionsUsed,
  };
}

export async function incrementQuota(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data, error } = await supabase.rpc("get_or_create_weekly_quota", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const quota = data as WeeklyQuotaRow;

  const { error: updateError } = await supabase
    .from("interview_weekly_quota")
    .update({ sessions_used: quota.sessions_used + 1 })
    .eq("id", quota.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
