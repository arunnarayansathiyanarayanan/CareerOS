import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_TIER_WEEKLY_SESSION_LIMIT = 1;

export type WeeklyQuotaRow = {
  id: string;
  user_id: string;
  week_start: string;
  sessions_used: number;
};

type TranscriptEntry = {
  role?: string;
};

/** True when the session only has the opening interviewer line (user never answered). */
export function isUnstartedInterviewTranscript(transcript: unknown): boolean {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return false;
  }
  return (transcript as TranscriptEntry[]).every((entry) => entry.role === "interviewer");
}

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

function getWeekEndExclusiveUtc(weekStart: string): string {
  const weekEnd = new Date(`${weekStart}T00:00:00.000Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return weekEnd.toISOString();
}

/** Counts in-progress or completed sessions in the current UTC week. */
export async function countWeeklyBillableSessions(
  supabase: SupabaseClient,
  userId: string,
  weekStart = getWeekStartUtc()
): Promise<number> {
  const { count, error } = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["in_progress", "completed"])
    .gte("created_at", `${weekStart}T00:00:00.000Z`)
    .lt("created_at", getWeekEndExclusiveUtc(weekStart));

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * Abandons stale in-progress sessions that never received a candidate answer
 * (e.g. start failed after insert but before the user could practice).
 */
export async function abandonUnstartedWeeklySessions(
  supabase: SupabaseClient,
  userId: string,
  weekStart = getWeekStartUtc()
): Promise<number> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("id, transcript")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .gte("created_at", `${weekStart}T00:00:00.000Z`)
    .lt("created_at", getWeekEndExclusiveUtc(weekStart));

  if (error) {
    throw new Error(error.message);
  }

  const staleIds = (data ?? [])
    .filter((row) =>
      isUnstartedInterviewTranscript(
        (row as { transcript: unknown }).transcript
      )
    )
    .map((row) => (row as { id: string }).id);

  if (staleIds.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from("interview_sessions")
    .update({ status: "abandoned" })
    .in("id", staleIds)
    .eq("user_id", userId)
    .eq("status", "in_progress");

  if (updateError) {
    throw new Error(updateError.message);
  }

  return staleIds.length;
}

export async function getWeeklySessionsUsed(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  await abandonUnstartedWeeklySessions(supabase, userId);
  return countWeeklyBillableSessions(supabase, userId);
}

export async function hasFreeWeeklyQuotaRemaining(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const used = await getWeeklySessionsUsed(supabase, userId);
  return used < FREE_TIER_WEEKLY_SESSION_LIMIT;
}

export async function deleteInterviewSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("interview_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
