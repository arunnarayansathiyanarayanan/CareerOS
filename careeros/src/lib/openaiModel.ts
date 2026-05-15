/** Default chat model for resume parsing and roadmap generation. Override with OPENAI_MODEL. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o";

export function getOpenAiModel(): string {
  return (process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;
}
