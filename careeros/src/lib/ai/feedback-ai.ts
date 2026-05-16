import {
  FeedbackAIError,
  FeedbackParseError,
} from "@/lib/ai/errors";
import type { InterviewContext } from "@/lib/ai/interview-ai";
import { openai } from "@/lib/ai/openai-client";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";

export type FeedbackInput = {
  track: string;
  subMode: string;
  transcript: Array<{
    role: "interviewer" | "candidate";
    content: string;
    timestamp_ms: number;
  }>;
  duration_seconds: number;
  projects: InterviewContext["userProjects"];
};

export type FeedbackMoment = {
  timestamp_ms: number;
  quote_snippet: string;
  reason: string;
};

export type ParsedFeedback = {
  overall_score: number;
  rubric_scores: {
    structure: number;
    clarity: number;
    ai_depth: number;
    tradeoffs: number;
    communication: number;
  };
  strong_moments: FeedbackMoment[];
  improvement_moments: FeedbackMoment[];
  recommended_next_sub_mode: string;
  raw_feedback_text: string;
};

const FEEDBACK_MODEL = "gpt-4o" as const;
const TEMPERATURE = 0.3;
const MAX_TOKENS = 1500;
const MOMENT_COUNT = 3;

const RUBRIC_KEYS = [
  "structure",
  "clarity",
  "ai_depth",
  "tradeoffs",
  "communication",
] as const;

type RubricKey = (typeof RUBRIC_KEYS)[number];

const PLACEHOLDER_STRONG: FeedbackMoment = {
  timestamp_ms: 0,
  quote_snippet: "(No specific moment identified)",
  reason:
    "The model did not surface a third strong moment; review the full transcript for highlights.",
};

const PLACEHOLDER_IMPROVEMENT: FeedbackMoment = {
  timestamp_ms: 0,
  quote_snippet: "(No specific moment identified)",
  reason:
    "The model did not surface a third improvement moment; review answers for depth and structure.",
};

function clampScore(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new FeedbackParseError(`Invalid numeric score for ${label}`);
  }
  return Math.min(10, Math.max(1, Math.round(n * 10) / 10));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMoment(value: unknown, label: string): FeedbackMoment {
  if (!isRecord(value)) {
    throw new FeedbackParseError(`${label} must be an object`);
  }

  const timestamp_ms = value.timestamp_ms;
  if (typeof timestamp_ms !== "number" || !Number.isFinite(timestamp_ms)) {
    throw new FeedbackParseError(`${label}.timestamp_ms must be a number`);
  }

  const quote_snippet = value.quote_snippet;
  if (typeof quote_snippet !== "string" || quote_snippet.trim().length === 0) {
    throw new FeedbackParseError(`${label}.quote_snippet must be a non-empty string`);
  }

  const reason = value.reason;
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new FeedbackParseError(`${label}.reason must be a non-empty string`);
  }

  return {
    timestamp_ms,
    quote_snippet: quote_snippet.trim(),
    reason: reason.trim(),
  };
}

function normalizeMoments(
  value: unknown,
  label: string,
  placeholder: FeedbackMoment
): FeedbackMoment[] {
  if (!Array.isArray(value)) {
    throw new FeedbackParseError(`${label} must be an array`);
  }

  const parsed = value.map((item, index) =>
    parseMoment(item, `${label}[${index}]`)
  );

  if (parsed.length > MOMENT_COUNT) {
    return parsed.slice(0, MOMENT_COUNT);
  }

  while (parsed.length < MOMENT_COUNT) {
    parsed.push({ ...placeholder });
  }

  return parsed;
}

function formatTranscript(
  transcript: FeedbackInput["transcript"]
): string {
  return transcript
    .map((entry) => {
      const seconds = (entry.timestamp_ms / 1000).toFixed(1);
      return `[${seconds}s] ${entry.role}: ${entry.content}`;
    })
    .join("\n");
}

function formatProjects(projects: FeedbackInput["projects"]): string {
  if (projects.length === 0) {
    return "(none provided)";
  }
  return projects
    .map(
      (p) =>
        `- ${p.name} | stack: ${p.stack.join(", ") || "n/a"} | outcome: ${p.outcome}`
    )
    .join("\n");
}

function buildFeedbackUserPrompt(session: FeedbackInput): string {
  return `Analyze this completed mock interview and respond ONLY with a single JSON object (no markdown fences, no preamble).

Session:
- track: ${session.track}
- sub_mode: ${session.subMode}
- duration_seconds: ${session.duration_seconds}

Candidate projects:
${formatProjects(session.projects)}

Transcript:
${formatTranscript(session.transcript)}

Required JSON shape (all keys required):
{
  "overall_score": number (1.0–10.0, one decimal),
  "rubric_scores": {
    "structure": number (1.0–10.0),
    "clarity": number (1.0–10.0),
    "ai_depth": number (1.0–10.0),
    "tradeoffs": number (1.0–10.0),
    "communication": number (1.0–10.0)
  },
  "strong_moments": array of exactly 3 objects: { "timestamp_ms": number, "quote_snippet": string (short quote from candidate), "reason": string },
  "improvement_moments": array of exactly 3 objects: same shape as strong_moments,
  "recommended_next_sub_mode": string (valid sub_mode id for this track, different from current if the candidate is ready to level up),
  "raw_feedback_text": string (2–4 paragraphs of actionable narrative feedback for the candidate)
}

Scoring guidance:
- structure: answer framing, STAR/case structure, logical flow
- clarity: crisp language, no rambling, understandable to a hiring manager
- ai_depth: technical/product AI literacy, appropriate use of concepts
- tradeoffs: risks, alternatives, constraints, second-order effects
- communication: confidence, listening, concision under pressure`;
}

const FEEDBACK_SYSTEM_PROMPT = `You are an expert AI interview coach for CareerOS. You evaluate mock interview transcripts for professionals targeting AI-native roles in the Indian job market. Be honest, specific, and constructive. Output only valid JSON matching the requested schema.`;

/** Parses model JSON into {@link ParsedFeedback}. Exported for unit tests. */
export function parseFeedbackResponse(rawJson: string): ParsedFeedback {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    throw new FeedbackParseError("Response was not valid JSON", { cause: error });
  }

  if (!isRecord(parsed)) {
    throw new FeedbackParseError("JSON root must be an object");
  }

  const overall_score = clampScore(parsed.overall_score, "overall_score");

  if (!isRecord(parsed.rubric_scores)) {
    throw new FeedbackParseError("rubric_scores must be an object");
  }

  const rubric_scores = {} as ParsedFeedback["rubric_scores"];
  for (const key of RUBRIC_KEYS) {
    rubric_scores[key as RubricKey] = clampScore(
      parsed.rubric_scores[key],
      `rubric_scores.${key}`
    );
  }

  const strong_moments = normalizeMoments(
    parsed.strong_moments,
    "strong_moments",
    PLACEHOLDER_STRONG
  );
  const improvement_moments = normalizeMoments(
    parsed.improvement_moments,
    "improvement_moments",
    PLACEHOLDER_IMPROVEMENT
  );

  const recommended_next_sub_mode = parsed.recommended_next_sub_mode;
  if (
    typeof recommended_next_sub_mode !== "string" ||
    recommended_next_sub_mode.trim().length === 0
  ) {
    throw new FeedbackParseError(
      "recommended_next_sub_mode must be a non-empty string"
    );
  }

  const raw_feedback_text = parsed.raw_feedback_text;
  if (
    typeof raw_feedback_text !== "string" ||
    raw_feedback_text.trim().length === 0
  ) {
    throw new FeedbackParseError("raw_feedback_text must be a non-empty string");
  }

  return {
    overall_score,
    rubric_scores,
    strong_moments,
    improvement_moments,
    recommended_next_sub_mode: recommended_next_sub_mode.trim(),
    raw_feedback_text: raw_feedback_text.trim(),
  };
}

function mapFeedbackFailure(error: unknown): FeedbackAIError | FeedbackParseError {
  if (error instanceof FeedbackParseError) return error;
  if (error instanceof FeedbackAIError) return error;
  const message =
    error instanceof Error ? error.message : "Feedback generation failed";
  return new FeedbackAIError("generation_failed", message, { cause: error });
}

export async function generateFeedback(
  session: FeedbackInput
): Promise<ParsedFeedback> {
  if (session.transcript.length === 0) {
    throw new FeedbackAIError(
      "empty_transcript",
      "Cannot generate feedback without a transcript"
    );
  }

  try {
    const completion = await withOpenAIRetry(() =>
      openai.chat.completions.create({
        model: FEEDBACK_MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: FEEDBACK_SYSTEM_PROMPT },
          { role: "user", content: buildFeedbackUserPrompt(session) },
        ],
      })
    );

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (content.length === 0) {
      throw new FeedbackAIError(
        "empty_response",
        "The feedback model returned an empty response"
      );
    }

    return parseFeedbackResponse(content);
  } catch (error) {
    throw mapFeedbackFailure(error);
  }
}
