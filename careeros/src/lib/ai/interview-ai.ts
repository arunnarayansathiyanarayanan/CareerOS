import { InterviewAIError } from "@/lib/ai/errors";
import { openai } from "@/lib/ai/openai-client";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";
import { buildInterviewSystemPrompt } from "@/lib/ai/question-bank";
import { synthesizeSpeech } from "@/lib/ai/tts";

export type InterviewMessage = {
  role: "system" | "assistant" | "user";
  content: string;
};

export type InterviewTurn = {
  question: string;
  audioBuffer?: Buffer;
  updatedHistory: InterviewMessage[];
};

export type InterviewContext = {
  track: "ai_pm" | "ai_generalist";
  subMode: string;
  userProjects: Array<{
    name: string;
    stack: string[];
    outcome: string;
    description: string;
  }>;
  history: InterviewMessage[];
  turnNumber: number;
  totalTurns: number;
};

const INTERVIEW_MODEL = "gpt-4o" as const;
const TEMPERATURE = 0.7;
const MAX_TOKENS = 400;

export function getInterviewSystemPrompt(
  track: string,
  subMode: string,
  projects: InterviewContext["userProjects"]
): string {
  return buildInterviewSystemPrompt(track, subMode, projects);
}

function buildTurnAwareSystemPrompt(ctx: InterviewContext): string {
  const base = getInterviewSystemPrompt(ctx.track, ctx.subMode, ctx.userProjects);
  const progress = `Interview progress: turn ${ctx.turnNumber} of ${ctx.totalTurns}.`;
  const finalTurnNote =
    ctx.turnNumber === ctx.totalTurns
      ? " This is the FINAL turn — thank the candidate, briefly summarize what you explored, and close the interview naturally. Do not ask another substantive question."
      : ctx.turnNumber === 1
        ? " Open the interview with a brief welcome and your first focused question."
        : " Continue the conversation based on the candidate's prior answers.";

  return `${base}\n\n${progress}${finalTurnNote}`;
}

function toChatMessages(
  systemPrompt: string,
  history: InterviewMessage[]
): Array<{ role: "system" | "assistant" | "user"; content: string }> {
  const nonSystem = history.filter((message) => message.role !== "system");
  return [{ role: "system", content: systemPrompt }, ...nonSystem];
}

function mapInterviewFailure(error: unknown): InterviewAIError {
  if (error instanceof InterviewAIError) return error;
  const message =
    error instanceof Error ? error.message : "Interview generation failed";
  return new InterviewAIError("generation_failed", message, { cause: error });
}

export async function generateInterviewerTurn(
  ctx: InterviewContext
): Promise<InterviewTurn> {
  const systemPrompt = buildTurnAwareSystemPrompt(ctx);
  const messages = toChatMessages(systemPrompt, ctx.history);

  try {
    const completion = await withOpenAIRetry(() =>
      openai.chat.completions.create({
        model: INTERVIEW_MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages,
      })
    );

    const question = completion.choices[0]?.message?.content?.trim() ?? "";
    if (question.length === 0) {
      throw new InterviewAIError(
        "empty_response",
        "The interviewer model returned an empty response"
      );
    }

    const audioBuffer = await synthesizeSpeech(question);

    const assistantMessage: InterviewMessage = {
      role: "assistant",
      content: question,
    };

    const updatedHistory: InterviewMessage[] = [
      ...ctx.history.filter((message) => message.role !== "system"),
      assistantMessage,
    ];

    return {
      question,
      audioBuffer,
      updatedHistory,
    };
  } catch (error) {
    throw mapInterviewFailure(error);
  }
}
