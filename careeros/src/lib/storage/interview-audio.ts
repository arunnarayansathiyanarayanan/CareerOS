import type { TranscriptEntry } from "@/lib/interviews/types";
import { uploadBuffer } from "@/lib/storage/r2";

export function getAudioKey(sessionId: string, turn: number): string {
  return `interviews/${sessionId}/turn-${turn}.mp3`;
}

export function getTranscriptKey(sessionId: string): string {
  return `interviews/${sessionId}/full-transcript.json`;
}

export function buildPublicAudioUrl(sessionId: string, turn: number): string | null {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/${getAudioKey(sessionId, turn)}`;
}

/** Max interviewer turn index present in the transcript (for replay URL keys). */
export function maxInterviewerTurn(transcript: TranscriptEntry[]): number {
  let max = 0;
  for (const entry of transcript) {
    if (
      entry.role === "interviewer" &&
      entry.turn_number != null &&
      entry.turn_number > max
    ) {
      max = entry.turn_number;
    }
  }
  return max;
}

/** Public URLs for turn-0 … turn-N (missing files are skipped at playback). */
export function buildSessionAudioUrls(
  sessionId: string,
  transcript: TranscriptEntry[]
): Record<number, string> {
  const maxTurn = maxInterviewerTurn(transcript);
  const urls: Record<number, string> = {};
  for (let turn = 0; turn <= maxTurn; turn++) {
    const url = buildPublicAudioUrl(sessionId, turn);
    if (url) urls[turn] = url;
  }
  return urls;
}

export async function uploadInterviewAudio(
  sessionId: string,
  turn: number,
  audioBuffer: Buffer
): Promise<string> {
  return uploadBuffer(getAudioKey(sessionId, turn), audioBuffer, "audio/mpeg");
}

export async function uploadTranscript(
  sessionId: string,
  transcript: TranscriptEntry[]
): Promise<string> {
  const buffer = Buffer.from(JSON.stringify(transcript), "utf-8");
  return uploadBuffer(
    getTranscriptKey(sessionId),
    buffer,
    "application/json"
  );
}
