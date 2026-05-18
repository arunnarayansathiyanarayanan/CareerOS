import { TURNS_BY_SUB_MODE, type SubMode } from "@/lib/ai/question-bank";
import {
  countCandidateTurns,
  expectedUserTurnNumber,
  normalizeTranscript,
} from "@/lib/interviews/transcript";
import type { InterviewSessionRow } from "@/lib/interviews/types";
import {
  buildPublicAudioUrl,
  maxInterviewerTurn,
} from "@/lib/storage/interview-audio";
export type StudioTranscriptEntry = {
  role: "interviewer" | "candidate";
  content: string;
  timestamp_ms: number;
  audioUrl?: string;
};

export type InterviewStudioInitialProps = {
  sessionId: string;
  mode: InterviewSessionRow["mode"];
  transcript: StudioTranscriptEntry[];
  currentQuestion: string;
  currentAudioUrl: string | null;
  turnNumber: number;
  totalTurns: number;
  initialState: "mic_check" | "listening";
  openingAlreadyPlayed: boolean;
};

export function buildInterviewStudioProps(
  session: InterviewSessionRow
): InterviewStudioInitialProps {
  const transcript = normalizeTranscript(session.transcript);
  const liveTranscript: StudioTranscriptEntry[] = transcript.map((entry) => ({
    role: entry.role,
    content: entry.content,
    timestamp_ms: entry.timestamp_ms,
  }));

  const candidateTurns = countCandidateTurns(transcript);
  const lastInterviewer = [...transcript]
    .reverse()
    .find((e) => e.role === "interviewer");

  const subMode = session.sub_mode as SubMode;
  const totalTurns = TURNS_BY_SUB_MODE[subMode] ?? 8;
  const lastInterviewerTurn = maxInterviewerTurn(transcript);
  const latestAudioUrl =
    buildPublicAudioUrl(session.id, lastInterviewerTurn) ?? session.audio_url;

  return {
    sessionId: session.id,
    mode: session.mode,
    transcript: liveTranscript,
    currentQuestion: lastInterviewer?.content ?? "",
    currentAudioUrl: latestAudioUrl,
    turnNumber: expectedUserTurnNumber(transcript),
    totalTurns,
    initialState: candidateTurns > 0 ? "listening" : "mic_check",
    openingAlreadyPlayed: candidateTurns > 0,
  };
}
