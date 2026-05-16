import type { InterviewMessage } from "@/lib/ai/interview-ai";
import type { TranscriptEntry } from "@/lib/interviews/types";

export function normalizeTranscript(raw: unknown): TranscriptEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is TranscriptEntry =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as TranscriptEntry).role !== undefined &&
      typeof (entry as TranscriptEntry).content === "string"
  );
}

export function countCandidateTurns(transcript: TranscriptEntry[]): number {
  return transcript.filter((e) => e.role === "candidate").length;
}

export function expectedUserTurnNumber(transcript: TranscriptEntry[]): number {
  return countCandidateTurns(transcript) + 1;
}

export function transcriptToInterviewHistory(
  transcript: TranscriptEntry[]
): InterviewMessage[] {
  return transcript.map((entry) => ({
    role: entry.role === "interviewer" ? "assistant" : "user",
    content: entry.content,
  }));
}

export function appendTranscriptEntry(
  transcript: TranscriptEntry[],
  entry: TranscriptEntry
): TranscriptEntry[] {
  return [...transcript, entry];
}

export function elapsedMsSinceStart(startedAtIso: string): number {
  const started = new Date(startedAtIso).getTime();
  return Math.max(0, Date.now() - started);
}
