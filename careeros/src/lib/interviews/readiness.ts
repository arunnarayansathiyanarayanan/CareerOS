import type { SupabaseClient } from "@supabase/supabase-js";

import type { Track } from "@/lib/ai/question-bank";

const MAX_SESSIONS = 10;

export function computeWeightedReadiness(
  scoresNewestFirst: number[]
): { score: number; avgOverall: number } {
  if (scoresNewestFirst.length === 0) {
    return { score: 0, avgOverall: 0 };
  }

  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < scoresNewestFirst.length; i++) {
    const weight = i === 0 ? 2 : 1;
    weightedSum += scoresNewestFirst[i]! * weight;
    weightTotal += weight;
  }

  const avgOverall =
    Math.round((weightedSum / weightTotal) * 10) / 10;
  const score = Math.round(avgOverall * 10 * 10) / 10;

  return { score, avgOverall };
}

export async function upsertReadinessScore(
  supabase: SupabaseClient,
  userId: string,
  track: Track
): Promise<void> {
  const { data: sessions, error: sessionsError } = await supabase
    .from("interview_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("track", track)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(MAX_SESSIONS);

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const sessionIds = (sessions ?? []).map((s) => (s as { id: string }).id);
  if (sessionIds.length === 0) {
    return;
  }

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("interview_feedback")
    .select("session_id, overall_score")
    .in("session_id", sessionIds);

  if (feedbackError) {
    throw new Error(feedbackError.message);
  }

  const scoreBySession = new Map(
    (feedbackRows ?? []).map((row) => [
      (row as { session_id: string }).session_id,
      Number((row as { overall_score: number }).overall_score),
    ])
  );

  const scoresNewestFirst = sessionIds
    .map((id) => scoreBySession.get(id))
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s));

  const { score, avgOverall } = computeWeightedReadiness(scoresNewestFirst);

  const { error: upsertError } = await supabase
    .from("interview_readiness_scores")
    .upsert(
      {
        user_id: userId,
        track,
        score,
        session_count: scoresNewestFirst.length,
        avg_overall_score: avgOverall,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,track" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}
