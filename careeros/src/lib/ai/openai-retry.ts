import { APIError, InternalServerError, RateLimitError } from "openai";

const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
const MAX_RETRIES = 3;

export function isRetryableOpenAIError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof InternalServerError) return true;
  if (error instanceof APIError) {
    return error.status === 429 || error.status >= 500;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Runs `fn` with up to 3 retries on OpenAI 429 / 5xx, backing off 1s → 2s → 4s.
 */
export async function withOpenAIRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < MAX_RETRIES && isRetryableOpenAIError(error);
      if (!canRetry) {
        break;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}
