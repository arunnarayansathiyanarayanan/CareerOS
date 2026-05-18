import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateFeedback,
  type ParsedFeedback,
} from "@/lib/ai/feedback-ai";
import { fetchInterviewProjects } from "@/lib/interviews/projects";
import { upsertReadinessScore } from "@/lib/interviews/readiness";
import {
  elapsedMsSinceStart,
  normalizeTranscript,
} from "@/lib/interviews/transcript";
import type {
  FeedbackResponse,
  InterviewSessionRow,
  TranscriptEntry,
} from "@/lib/interviews/types";
import { recordStreakAction } from "@/lib/streak/record-action";
import * as streakService from "@/server/services/streak.service";

function feedbackRowToParsed(row: {
  overall_score: number;
  rubric_scores: ParsedFeedback["rubric_scores"];
  strong_moments: ParsedFeedback["strong_moments"];
  improvement_moments: ParsedFeedback["improvement_moments"];
  recommended_next_sub_mode: string;
  raw_feedback_text: string;
}): ParsedFeedback {
  return {
    overall_score: Number(row.overall_score),
    rubric_scores: row.rubric_scores,
    strong_moments: row.strong_moments,
    improvement_moments: row.improvement_moments,
    recommended_next_sub_mode: row.recommended_next_sub_mode,
    raw_feedback_text: row.raw_feedback_text,
  };
}

export async function loadOwnedSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<InterviewSessionRow | null> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as InterviewSessionRow | null) ?? null;
}

export async function getInterviewFeedbackResponse(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<FeedbackResponse | { error: "not_found" }> {
  const session = await loadOwnedSession(supabase, sessionId, userId);
  if (!session) {
    return { error: "not_found" };
  }

  const { data: existingFeedback } = await supabase
    .from("interview_feedback")
    .select(
      "overall_score, rubric_scores, strong_moments, improvement_moments, recommended_next_sub_mode, raw_feedback_text"
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existingFeedback) {
    return {
      sessionId,
      feedback: feedbackRowToParsed(
        existingFeedback as Parameters<typeof feedbackRowToParsed>[0]
      ),
    };
  }

  if (session.status !== "completed") {
    return { status: "pending" };
  }

  const feedback = await generateAndPersistInterviewFeedback(
    supabase,
    session,
    userId
  );

  return { sessionId, feedback };
}

export async function generateAndPersistInterviewFeedback(
  supabase: SupabaseClient,
  session: InterviewSessionRow,
  userId: string
): Promise<ParsedFeedback> {
  const transcript = normalizeTranscript(session.transcript);
  const projects = await fetchInterviewProjects(
    supabase,
    userId,
    session.project_context_ids
  );

  const durationSeconds =
    session.duration_seconds ??
    Math.round(elapsedMsSinceStart(session.started_at) / 1000);

  const feedback = await generateFeedback({
    track: session.track,
    subMode: session.sub_mode,
    transcript: transcript.map((entry: TranscriptEntry) => ({
      role: entry.role,
      content: entry.content,
      timestamp_ms: entry.timestamp_ms,
    })),
    duration_seconds: durationSeconds,
    projects,
  });

  const { error: insertError } = await supabase.from("interview_feedback").insert({
    session_id: session.id,
    overall_score: feedback.overall_score,
    rubric_scores: feedback.rubric_scores,
    strong_moments: feedback.strong_moments,
    improvement_moments: feedback.improvement_moments,
    recommended_next_sub_mode: feedback.recommended_next_sub_mode,
    raw_feedback_text: feedback.raw_feedback_text,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("interview_feedback")
        .select(
          "overall_score, rubric_scores, strong_moments, improvement_moments, recommended_next_sub_mode, raw_feedback_text"
        )
        .eq("session_id", session.id)
        .single();
      if (existing) {
        return feedbackRowToParsed(
          existing as Parameters<typeof feedbackRowToParsed>[0]
        );
      }
    }
    throw new Error(insertError.message);
  }

  await upsertReadinessScore(supabase, userId, session.track);

  try {
    await recordStreakAction(userId, "interview_completed", supabase);
  } catch (streakError) {
    console.error("[interviews/feedback] streak record:", streakError);
  }

  streakService
    .recordStreakEvent(userId, "INTERVIEW_DONE", {
      interviewId: session.id,
    })
    .catch((e) => console.error("streak event failed", e));

  return feedback;
}
