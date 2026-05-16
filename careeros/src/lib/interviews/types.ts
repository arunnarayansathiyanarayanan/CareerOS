import type { ParsedFeedback } from "@/lib/ai/feedback-ai";

export type RubricScores = ParsedFeedback["rubric_scores"];
import type { Track, SubMode } from "@/lib/ai/question-bank";

export type { Track, SubMode, ParsedFeedback };

export type InterviewMode = "voice" | "text";

export type TranscriptRole = "interviewer" | "candidate";

export type TranscriptEntry = {
  role: TranscriptRole;
  content: string;
  timestamp_ms: number;
  turn_number?: number;
};

/** Alias used by interview UI components. */
export type InterviewSession = InterviewSessionRow;

export type InterviewSessionRow = {
  id: string;
  user_id: string;
  track: Track;
  sub_mode: string;
  status: "pending" | "in_progress" | "completed" | "abandoned";
  mode: InterviewMode;
  duration_seconds: number | null;
  project_context_ids: string[] | null;
  audio_url: string | null;
  transcript: TranscriptEntry[] | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type ReadinessScore = {
  track: Track;
  score: number;
  session_count: number;
  avg_overall_score: number;
  computed_at: string;
};

export type SessionWithScore = {
  id: string;
  track: Track;
  sub_mode: string;
  completed_at: string;
  duration_seconds: number | null;
  overall_score: number | null;
  rubric_scores: RubricScores | null;
  recommended_next_sub_mode: string | null;
};

export type StartInterviewBody = {
  track: Track;
  subMode: SubMode;
  projectContextIds?: string[];
};

export type StartInterviewResponse = {
  sessionId: string;
  openingQuestion: string;
  audioUrl: string;
  totalTurns: number;
};

export type TurnInterviewResponse = {
  question: string;
  audioUrl: string | null;
  turnNumber: number;
  isComplete: boolean;
  transcribedText?: string;
};

export type FeedbackResponse =
  | { feedback: ParsedFeedback; sessionId: string }
  | { status: "pending" };

export type HistoryResponse = {
  sessions: SessionWithScore[];
  total: number;
  page: number;
};

export type ReadinessResponse = {
  scores: ReadinessScore[];
};
