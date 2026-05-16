import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ParsedFeedback } from "@/lib/ai/feedback-ai";
import type {
  HistoryResponse,
  RubricScores,
  SessionWithScore,
  Track,
} from "@/lib/interviews/types";

export type InterviewHistoryOptions = {
  track?: Track;
  page?: number;
  limit?: number;
};

function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveUserId(
  supabase: SupabaseClient,
  clerkId: string
): Promise<string | null> {
  const { data: userRow, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error || !userRow?.id || typeof userRow.id !== "string") {
    return null;
  }
  return userRow.id;
}

function parseRubricScores(
  value: unknown
): RubricScores | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const keys = [
    "structure",
    "clarity",
    "ai_depth",
    "tradeoffs",
    "communication",
  ] as const;
  for (const key of keys) {
    if (typeof row[key] !== "number") return null;
  }
  return row as RubricScores;
}

export async function getInterviewHistoryForUser(
  userId: string,
  options: InterviewHistoryOptions = {}
): Promise<HistoryResponse | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const offset = (page - 1) * limit;
  const { track } = options;

  let countQuery = supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");

  if (track) {
    countQuery = countQuery.eq("track", track);
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    console.error("[interviews/history] count:", countError.message);
    return null;
  }

  let listQuery = supabase
    .from("interview_sessions")
    .select("id, track, sub_mode, completed_at, duration_seconds")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (track) {
    listQuery = listQuery.eq("track", track);
  }

  const { data: sessions, error: listError } = await listQuery;
  if (listError) {
    console.error("[interviews/history] list:", listError.message);
    return null;
  }

  const sessionIds = (sessions ?? []).map((s) => (s as { id: string }).id);
  const feedbackBySession = new Map<
    string,
    {
      overall_score: number;
      rubric_scores: RubricScores | null;
      recommended_next_sub_mode: string;
    }
  >();

  if (sessionIds.length > 0) {
    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("interview_feedback")
      .select(
        "session_id, overall_score, rubric_scores, recommended_next_sub_mode"
      )
      .in("session_id", sessionIds);

    if (feedbackError) {
      console.error("[interviews/history] feedback:", feedbackError.message);
      return null;
    }

    for (const row of feedbackRows ?? []) {
      const fb = row as {
        session_id: string;
        overall_score: number;
        rubric_scores: ParsedFeedback["rubric_scores"];
        recommended_next_sub_mode: string;
      };
      feedbackBySession.set(fb.session_id, {
        overall_score: Number(fb.overall_score),
        rubric_scores: parseRubricScores(fb.rubric_scores),
        recommended_next_sub_mode: fb.recommended_next_sub_mode,
      });
    }
  }

  const mapped: SessionWithScore[] = (sessions ?? []).map((row) => {
    const s = row as {
      id: string;
      track: Track;
      sub_mode: string;
      completed_at: string;
      duration_seconds: number | null;
    };
    const fb = feedbackBySession.get(s.id);
    return {
      id: s.id,
      track: s.track,
      sub_mode: s.sub_mode,
      completed_at: s.completed_at,
      duration_seconds: s.duration_seconds,
      overall_score: fb?.overall_score ?? null,
      rubric_scores: fb?.rubric_scores ?? null,
      recommended_next_sub_mode: fb?.recommended_next_sub_mode ?? null,
    };
  });

  return {
    sessions: mapped,
    total: count ?? 0,
    page,
  };
}

export async function getInterviewHistoryForClerk(
  clerkId: string,
  options: InterviewHistoryOptions = {}
): Promise<HistoryResponse | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const userId = await resolveUserId(supabase, clerkId);
  if (!userId) return null;

  return getInterviewHistoryForUser(userId, options);
}

/** Last N scored sessions across all tracks (oldest first) for the progress chart. */
export async function getChartSessionsForClerk(
  clerkId: string,
  limit = 10
): Promise<SessionWithScore[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const userId = await resolveUserId(supabase, clerkId);
  if (!userId) return [];

  const { data: sessions, error: listError } = await supabase
    .from("interview_sessions")
    .select("id, track, sub_mode, completed_at, duration_seconds")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50);

  if (listError || !sessions?.length) return [];

  const sessionIds = sessions.map((s) => (s as { id: string }).id);
  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("interview_feedback")
    .select(
      "session_id, overall_score, rubric_scores, recommended_next_sub_mode"
    )
    .in("session_id", sessionIds);

  if (feedbackError) return [];

  const feedbackBySession = new Map<
    string,
    {
      overall_score: number;
      rubric_scores: RubricScores | null;
      recommended_next_sub_mode: string;
    }
  >();

  for (const row of feedbackRows ?? []) {
    const fb = row as {
      session_id: string;
      overall_score: number;
      rubric_scores: ParsedFeedback["rubric_scores"];
      recommended_next_sub_mode: string;
    };
    feedbackBySession.set(fb.session_id, {
      overall_score: Number(fb.overall_score),
      rubric_scores: parseRubricScores(fb.rubric_scores),
      recommended_next_sub_mode: fb.recommended_next_sub_mode,
    });
  }

  const scored: SessionWithScore[] = [];
  for (const row of sessions) {
    const s = row as {
      id: string;
      track: Track;
      sub_mode: string;
      completed_at: string;
      duration_seconds: number | null;
    };
    const fb = feedbackBySession.get(s.id);
    if (fb?.overall_score == null) continue;
    scored.push({
      id: s.id,
      track: s.track,
      sub_mode: s.sub_mode,
      completed_at: s.completed_at,
      duration_seconds: s.duration_seconds,
      overall_score: fb.overall_score,
      rubric_scores: fb.rubric_scores,
      recommended_next_sub_mode: fb.recommended_next_sub_mode,
    });
  }

  const byTrack: Record<Track, SessionWithScore[]> = {
    ai_pm: [],
    ai_generalist: [],
  };

  for (const session of scored) {
    byTrack[session.track].push(session);
  }

  const merged: SessionWithScore[] = [];
  for (const track of ["ai_pm", "ai_generalist"] as const) {
    const tail = byTrack[track]
      .sort(
        (a, b) =>
          new Date(a.completed_at).getTime() -
          new Date(b.completed_at).getTime()
      )
      .slice(-limit);
    merged.push(...tail);
  }

  return merged.sort(
    (a, b) =>
      new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
  );
}
