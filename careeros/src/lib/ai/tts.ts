import { TTSError } from "@/lib/ai/errors";
import { openai } from "@/lib/ai/openai-client";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";

export type TTSVoice = "alloy" | "echo" | "nova";

const TTS_MODEL = "tts-1" as const;
const MAX_INPUT_CHARS = 4096;
const DEFAULT_VOICE: TTSVoice = "nova";

function truncateForTts(text: string): string {
  if (text.length <= MAX_INPUT_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_INPUT_CHARS - 1)}…`;
}

function mapTtsFailure(error: unknown): TTSError {
  if (error instanceof TTSError) return error;
  const message =
    error instanceof Error ? error.message : "Text-to-speech request failed";
  return new TTSError("synthesis_failed", message, { cause: error });
}

export async function synthesizeSpeech(
  text: string,
  voice: TTSVoice = DEFAULT_VOICE
): Promise<Buffer> {
  const input = truncateForTts(text.trim());
  if (input.length === 0) {
    throw new TTSError("empty_input", "Cannot synthesize empty text");
  }

  try {
    const response = await withOpenAIRetry(() =>
      openai.audio.speech.create({
        model: TTS_MODEL,
        voice,
        input,
        response_format: "mp3",
      })
    );

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    throw mapTtsFailure(error);
  }
}
