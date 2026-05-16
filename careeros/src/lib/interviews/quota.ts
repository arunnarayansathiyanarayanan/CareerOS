import type { SupabaseClient } from "@supabase/supabase-js";

export type WeeklyQuotaRow = {
  id: string;
  user_id: string;
  week_start: string;
  sessions_used: number;
};

/** ISO week start (Monday) in UTC, matching Postgres `date_trunc('week', ...)`. */
export function getWeekStartUtc(date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Next Monday 00:00:00 UTC as ISO string (quota reset). */
export function getNextMondayResetIso(date = new Date()): string {
  const weekStart = getWeekStartUtc(date);
  const next = new Date(`${weekStart}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 7);
  return next.toISOString();
}

export async function getOrCreateWeeklyQuota(
  supabase: SupabaseClient,
  userId: string
): Promise<WeeklyQuotaRow> {
  const weekStart = getWeekStartUtc();

  const { data: existing, error: selectError } = await supabase
    .from("interview_weekly_quota")
    .select("id, user_id, week_start, sessions_used")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }
  if (existing) {
    return existing as WeeklyQuotaRow;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("interview_weekly_quota")
    .insert({ user_id: userId, week_start: weekStart, sessions_used: 0 })
    .select("id, user_id, week_start, sessions_used")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: retry } = await supabase
        .from("interview_weekly_quota")
        .select("id, user_id, week_start, sessions_used")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .single();
      if (retry) return retry as WeeklyQuotaRow;
    }
    throw new Error(insertError.message);
  }

  return inserted as WeeklyQuotaRow;
}

export async function isPaidInterviewTier(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[interviews/quota] profiles.is_pro lookup:", error.message);
    return false;
  }

  return Boolean(data?.is_pro);
}

export async function incrementWeeklyQuotaUsed(
  supabase: SupabaseClient,
  quotaId: string,
  currentUsed: number
): Promise<void> {
  const { error } = await supabase
    .from("interview_weekly_quota")
    .update({ sessions_used: currentUsed + 1 })
    .eq("id", quotaId);

  if (error) {
    throw new Error(error.message);
  }
}
