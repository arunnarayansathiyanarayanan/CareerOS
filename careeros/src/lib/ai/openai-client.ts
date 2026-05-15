import OpenAI from "openai";

const MISSING_KEY_MESSAGE =
  "OPENAI_API_KEY is missing or empty. Set it in your environment before using AI features.";

export function validateOpenAIKey(): void {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error(MISSING_KEY_MESSAGE);
  }
}

validateOpenAIKey();

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!.trim(),
});
