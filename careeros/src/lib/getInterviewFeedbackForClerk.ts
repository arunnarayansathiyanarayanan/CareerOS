import { createClient } from "@supabase/supabase-js";

import type { ParsedFeedback } from "@/lib/ai/feedback-ai";
import { getInterviewSessionForClerk } from "@/lib/getInterviewSessionForClerk";
import type { InterviewSessionRow } from "@/lib/interviews/types";

export type InterviewFeedbackBundle = {
  session: InterviewSessionRow;
  feedback: ParsedFeedback | null;
  helpfulnessRating: number | null;
};

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

/**
 * Loads session plus persisted feedback (if any) for the feedback report page.
 */
export async function getInterviewFeedbackForClerk(
  clerkId: string,
  sessionId: string
): Promise<InterviewFeedbackBundle | null> {
  const session = await getInterviewSessionForClerk(clerkId, sessionId);
  if (!session) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { session, feedback: null, helpfulnessRating: null };
  }

  const supabase = createClient(url, key);

  const { data: row, error } = await supabase
    .from("interview_feedback")
    .select(
      "overall_score, rubric_scores, strong_moments, improvement_moments, recommended_next_sub_mode, raw_feedback_text, helpfulness_rating"
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[getInterviewFeedbackForClerk]", error.message);
    return { session, feedback: null, helpfulnessRating: null };
  }

  if (!row) {
    return { session, feedback: null, helpfulnessRating: null };
  }

  return {
    session,
    feedback: feedbackRowToParsed(
      row as Parameters<typeof feedbackRowToParsed>[0]
    ),
    helpfulnessRating:
      row.helpfulness_rating != null ? Number(row.helpfulness_rating) : null,
  };
}
