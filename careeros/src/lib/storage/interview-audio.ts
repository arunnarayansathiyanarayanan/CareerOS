import type { SupabaseClient } from "@supabase/supabase-js";

import type { TranscriptEntry } from "@/lib/interviews/types";
import {
  assertR2Configured,
  getInterviewAudioStorage,
  usesR2ForInterviewAudio,
} from "@/lib/storage/r2-config";
import { StorageError, uploadBuffer } from "@/lib/storage/r2";

export const INTERVIEW_AUDIO_BUCKET = "interview-audio";

export function getAudioKey(sessionId: string, turn: number): string {
  return `interviews/${sessionId}/turn-${turn}.mp3`;
}

export function getSupabaseInterviewAudioPath(
  sessionId: string,
  turn: number
): string {
  return `${sessionId}/turn-${turn}.mp3`;
}

export function getTranscriptKey(sessionId: string): string {
  return `interviews/${sessionId}/full-transcript.json`;
}

export { getInterviewAudioStorage, usesR2ForInterviewAudio } from "@/lib/storage/r2-config";
export { isR2Configured, getR2ConfigIssues } from "@/lib/storage/r2-config";

export function buildSupabasePublicAudioUrl(
  sessionId: string,
  turn: number
): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${INTERVIEW_AUDIO_BUCKET}/${getSupabaseInterviewAudioPath(sessionId, turn)}`;
}

export function buildPublicAudioUrl(sessionId: string, turn: number): string | null {
  if (usesR2ForInterviewAudio()) {
    const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    if (!base) return null;
    return `${base}/${getAudioKey(sessionId, turn)}`;
  }
  return buildSupabasePublicAudioUrl(sessionId, turn);
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

async function uploadInterviewAudioToSupabase(
  supabase: SupabaseClient,
  sessionId: string,
  turn: number,
  audioBuffer: Buffer
): Promise<string> {
  const objectPath = getSupabaseInterviewAudioPath(sessionId, turn);

  const { error } = await supabase.storage
    .from(INTERVIEW_AUDIO_BUCKET)
    .upload(objectPath, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error) {
    throw new StorageError(objectPath, error.message, { cause: error });
  }

  const { data } = supabase.storage
    .from(INTERVIEW_AUDIO_BUCKET)
    .getPublicUrl(objectPath);

  if (!data.publicUrl) {
    throw new StorageError(objectPath, "Failed to resolve public audio URL");
  }

  return data.publicUrl;
}

export async function uploadInterviewAudio(
  sessionId: string,
  turn: number,
  audioBuffer: Buffer,
  supabase?: SupabaseClient
): Promise<string> {
  const key = getAudioKey(sessionId, turn);

  if (usesR2ForInterviewAudio()) {
    assertR2Configured();
    return uploadBuffer(key, audioBuffer, "audio/mpeg");
  }

  if (!supabase) {
    throw new StorageError(
      key,
      "Interview audio storage is set to Supabase but no client was provided."
    );
  }

  return uploadInterviewAudioToSupabase(supabase, sessionId, turn, audioBuffer);
}

export async function uploadTranscript(
  sessionId: string,
  transcript: TranscriptEntry[],
  supabase?: SupabaseClient
): Promise<string> {
  const buffer = Buffer.from(JSON.stringify(transcript), "utf-8");
  const key = getTranscriptKey(sessionId);

  if (usesR2ForInterviewAudio()) {
    assertR2Configured();
    return uploadBuffer(key, buffer, "application/json");
  }

  if (!supabase) {
    throw new StorageError(key, "Transcript storage requires a Supabase client");
  }

  const objectPath = `${sessionId}/full-transcript.json`;
  const { error } = await supabase.storage
    .from(INTERVIEW_AUDIO_BUCKET)
    .upload(objectPath, buffer, {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    throw new StorageError(objectPath, error.message, { cause: error });
  }

  const { data } = supabase.storage
    .from(INTERVIEW_AUDIO_BUCKET)
    .getPublicUrl(objectPath);

  return data.publicUrl;
}
