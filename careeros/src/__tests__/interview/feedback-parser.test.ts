import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackParseError } from "@/lib/ai/errors";
import {
  generateFeedback,
  parseFeedbackResponse,
  type FeedbackMoment,
} from "@/lib/ai/feedback-ai";

const openaiCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/openai-client", () => ({
  openai: {
    chat: {
      completions: {
        create: openaiCreate,
      },
    },
  },
}));

vi.mock("@/lib/ai/openai-retry", () => ({
  withOpenAIRetry: (fn: () => Promise<unknown>) => fn(),
}));

const moment = (
  index: number,
  label: "strong" | "improvement"
): FeedbackMoment => ({
  timestamp_ms: index * 1000,
  quote_snippet: `${label} quote ${index}`,
  reason: `${label} reason ${index}`,
});

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    overall_score: 7.5,
    rubric_scores: {
      structure: 8,
      clarity: 7,
      ai_depth: 7,
      tradeoffs: 6,
      communication: 8,
    },
    strong_moments: [moment(1, "strong"), moment(2, "strong"), moment(3, "strong")],
    improvement_moments: [
      moment(1, "improvement"),
      moment(2, "improvement"),
      moment(3, "improvement"),
    ],
    recommended_next_sub_mode: "product_sense",
    raw_feedback_text: "Solid narrative feedback for the candidate.",
    ...overrides,
  };
}

describe("parseFeedbackResponse", () => {
  it("parses valid JSON", () => {
    const parsed = parseFeedbackResponse(JSON.stringify(validPayload()));
    expect(parsed.overall_score).toBe(7.5);
    expect(parsed.rubric_scores.structure).toBe(8);
    expect(parsed.strong_moments).toHaveLength(3);
    expect(parsed.improvement_moments).toHaveLength(3);
    expect(parsed.recommended_next_sub_mode).toBe("product_sense");
    expect(parsed.raw_feedback_text).toContain("Solid narrative");
  });

  it("throws FeedbackParseError on malformed JSON", () => {
    expect(() => parseFeedbackResponse("{ not json")).toThrow(FeedbackParseError);
    expect(() => parseFeedbackResponse("{ not json")).toThrow(/valid JSON/i);
  });

  it("clamps scores to 1–10", () => {
    const parsed = parseFeedbackResponse(
      JSON.stringify(
        validPayload({
          overall_score: 12,
          rubric_scores: {
            structure: -1,
            clarity: 7,
            ai_depth: 7,
            tradeoffs: 6,
            communication: 8,
          },
        })
      )
    );
    expect(parsed.overall_score).toBe(10);
    expect(parsed.rubric_scores.structure).toBe(1);
  });

  it("trims more than three strong moments to three", () => {
    const parsed = parseFeedbackResponse(
      JSON.stringify(
        validPayload({
          strong_moments: [
            moment(1, "strong"),
            moment(2, "strong"),
            moment(3, "strong"),
            moment(4, "strong"),
            moment(5, "strong"),
          ],
        })
      )
    );
    expect(parsed.strong_moments).toHaveLength(3);
    expect(parsed.strong_moments[0]?.quote_snippet).toBe("strong quote 1");
    expect(parsed.strong_moments[2]?.quote_snippet).toBe("strong quote 3");
  });
});

describe("generateFeedback", () => {
  beforeEach(() => {
    openaiCreate.mockReset();
  });

  it("parses mocked OpenAI JSON via generateFeedback", async () => {
    openaiCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(validPayload({ overall_score: 8.2 })),
          },
        },
      ],
    });

    const result = await generateFeedback({
      track: "ai_pm",
      subMode: "product_sense",
      duration_seconds: 600,
      transcript: [
        {
          role: "interviewer",
          content: "Tell me about a product.",
          timestamp_ms: 0,
        },
        {
          role: "candidate",
          content: "I would start with user research.",
          timestamp_ms: 5000,
        },
      ],
      projects: [],
    });

    expect(result.overall_score).toBe(8.2);
    expect(openaiCreate).toHaveBeenCalled();
  });
});
