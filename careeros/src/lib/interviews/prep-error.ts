import { TTSError } from "@/lib/ai/errors";
import { StorageError } from "@/lib/storage/r2";
import { R2ConfigError } from "@/lib/storage/r2-config";

export function formatInterviewPrepError(error: unknown): string {
  if (error instanceof TTSError) {
    return "Could not generate interviewer voice. Check OPENAI_API_KEY and OpenAI billing.";
  }

  if (error instanceof R2ConfigError) {
    return error.message;
  }

  if (error instanceof StorageError) {
    const causeMessage =
      error.cause instanceof Error ? error.cause.message : undefined;
    if (
      causeMessage?.includes("Unauthorized") ||
      causeMessage?.includes("Access Denied") ||
      causeMessage?.includes("403") ||
      causeMessage?.includes("InvalidAccessKeyId")
    ) {
      return "R2 rejected the upload. Use an R2 S3 API token (not a Cloudflare API token) and ensure the bucket allows public access via your R2_PUBLIC_URL.";
    }
    if (error.message.includes("not configured")) {
      return error.message;
    }
    return `Could not store interview audio on R2.${causeMessage ? ` (${causeMessage})` : ""}`;
  }

  if (error instanceof Error) {
    if (error.message.includes("OPENAI_API_KEY")) {
      return error.message;
    }
    if (error.message.includes("Missing R2_")) {
      return "R2 is not configured. Set INTERVIEW_AUDIO_STORAGE=r2 and all R2_* variables in .env.local.";
    }
  }

  return "Failed to prepare interview audio";
}
