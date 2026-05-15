import OpenAI, { APIConnectionError, APIConnectionTimeoutError, InternalServerError, RateLimitError } from "openai";
import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { projects } from "@/db/schema/projects";
import type { AiReviewerData } from "@/db/schema/projects";

const REVIEWER_MODEL = "gpt-4o" as const;

const SYSTEM_PROMPT =
  "You are an expert AI career coach evaluating proof-of-work projects submitted by professionals transitioning into AI roles. Your job is to give honest, specific, constructive feedback that helps candidates improve their portfolio and stand out to AI hiring managers.";

export type ProjectReviewInput = {
  title: string;
  one_liner: string;
  problem_solved: string;
  ai_stack: string[];
  my_role: string;
  outcome: string;
  embeds: { type: string; url?: string }[];
};

export type ProjectReviewResult = {
  score: number;
  strengths: string[];
  improvements: string[];
  portfolio_ready: boolean;
  reasoning: string;
};

export class ReviewParseError extends Error {
  constructor(
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = "ReviewParseError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, ReviewParseError.prototype);
  }
}

function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

function buildUserPrompt(project: ProjectReviewInput): string {
  const embedLines = project.embeds
    .map((e, i) => {
      const urlPart = e.url ? `, url: ${e.url}` : "";
      return `  ${i + 1}. type: ${e.type}${urlPart}`;
    })
    .join("\n");

  return `Evaluate the following proof-of-work project and respond ONLY with a single JSON object (no markdown fences, no preamble or trailing text).

Required JSON shape (all keys required):
- "score": integer from 1 to 10 (overall portfolio impact and clarity for AI hiring managers)
- "strengths": array of exactly 3 strings; each string is 1–2 sentences of specific praise
- "improvements": array of exactly 3 strings; each string is 1–2 sentences of actionable feedback
- "portfolio_ready": boolean (your preliminary view; it will be reconciled server-side)
- "reasoning": one concise sentence explaining the score (internal note, not shown to candidates in some surfaces)

Project fields:

Title: ${project.title}

One-liner: ${project.one_liner}

Problem solved (description): ${project.problem_solved}

AI stack: ${JSON.stringify(project.ai_stack)}

My role: ${project.my_role}

Outcome: ${project.outcome}

Embeds (${project.embeds.length}):
${embedLines || "  (none)"}`;
}

function clampScore(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    throw new ReviewParseError("Invalid score: not a finite number");
  }
  return Math.min(10, Math.max(1, Math.round(n)));
}

function assertStringArrayOfThree(label: string, value: unknown): string[] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new ReviewParseError(`${label} must be an array of exactly 3 strings`);
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new ReviewParseError(`${label} must contain non-empty strings`);
    }
    out.push(item.trim());
  }
  return out;
}

function parseProjectReviewResult(
  rawJson: string,
  project: ProjectReviewInput
): ProjectReviewResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    throw new ReviewParseError("Response was not valid JSON", { cause: e });
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ReviewParseError("JSON root must be an object");
  }

  const o = parsed as Record<string, unknown>;
  const score = clampScore(o.score);
  const strengths = assertStringArrayOfThree("strengths", o.strengths);
  const improvements = assertStringArrayOfThree("improvements", o.improvements);

  if (typeof o.reasoning !== "string" || o.reasoning.trim().length === 0) {
    throw new ReviewParseError("reasoning must be a non-empty string");
  }

  const portfolioReady =
    score >= 5 &&
    project.problem_solved.trim().length >= 100 &&
    project.embeds.length >= 1;

  return {
    score,
    strengths,
    improvements,
    portfolio_ready: portfolioReady,
    reasoning: o.reasoning.trim(),
  };
}

function isRetryableError(e: unknown): boolean {
  if (e instanceof ReviewParseError) return true;
  if (e instanceof APIConnectionError) return true;
  if (e instanceof APIConnectionTimeoutError) return true;
  if (e instanceof InternalServerError) return true;
  if (e instanceof RateLimitError) return true;
  if (e instanceof TypeError) {
    const msg = String((e as Error).message).toLowerCase();
    if (msg.includes("fetch") || msg.includes("network")) return true;
  }
  return false;
}

async function callOpenAIOnce(
  client: OpenAI,
  project: ProjectReviewInput
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: REVIEWER_MODEL,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(project) },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new ReviewParseError("OpenAI returned empty content");
  }
  return content.trim();
}

/**
 * Runs GPT-4o review with retries (up to 2 retries on network or parse failure).
 * Persist with {@link saveProjectAiReviewResult} after success.
 */
export async function reviewProject(
  project: ProjectReviewInput
): Promise<ProjectReviewResult> {
  const client = getOpenAIClient();

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await callOpenAIOnce(client, project);
      return parseProjectReviewResult(raw, project);
    } catch (e) {
      lastError = e;
      if (attempt === 2 || !isRetryableError(e)) {
        throw e;
      }
    }
  }
  throw lastError;
}

/** Writes score + reviewer payload to `projects` after a successful review. */
export async function saveProjectAiReviewResult(
  projectId: string,
  result: ProjectReviewResult
): Promise<void> {
  const row: AiReviewerData = {
    strengths: result.strengths,
    improvements: result.improvements,
    portfolio_ready: result.portfolio_ready,
    reasoning: result.reasoning,
  };

  const db = getDb();
  await db
    .update(projects)
    .set({
      aiReviewerScore: result.score,
      aiReviewerData: row,
      aiReviewerCallCount: sql`${projects.aiReviewerCallCount} + 1`,
    })
    .where(eq(projects.id, projectId));
}
