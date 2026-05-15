import { toFile } from "openai";

import { STTError } from "@/lib/ai/errors";
import { openai } from "@/lib/ai/openai-client";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";

export type STTResult = {
  text: string;
  duration_seconds: number;
  language: string;
};

const WHISPER_MODEL = "whisper-1" as const;

function extensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
  };
  return map[normalized] ?? "webm";
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function mapSttFailure(error: unknown): STTError {
  if (error instanceof STTError) return error;
  const message =
    error instanceof Error ? error.message : "Speech-to-text request failed";
  return new STTError("transcription_failed", message, { cause: error });
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<STTResult> {
  const ext = extensionFromMimeType(mimeType);

  try {
    const file = await toFile(audioBuffer, `audio.${ext}`, { type: mimeType });

    const response = await withOpenAIRetry(() =>
      openai.audio.transcriptions.create({
        file,
        model: WHISPER_MODEL,
        language: "en",
        response_format: "verbose_json",
      })
    );

    const text = response.text?.trim() ?? "";
    if (text.length === 0 || countWords(text) < 3) {
      throw new STTError(
        "transcript_too_short",
        "Transcript is empty or shorter than three words"
      );
    }

    const duration =
      typeof response.duration === "number" && Number.isFinite(response.duration)
        ? response.duration
        : 0;
    const language =
      typeof response.language === "string" && response.language.length > 0
        ? response.language
        : "en";

    return {
      text,
      duration_seconds: duration,
      language,
    };
  } catch (error) {
    throw mapSttFailure(error);
  }
}
