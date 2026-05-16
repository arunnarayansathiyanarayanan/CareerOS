import {
  getOpeningQuestion,
  validateSubMode,
} from "@/lib/ai/question-bank";
import { authErrorResponse } from "@/lib/auth/require-auth";
import { recordStreakAction } from "@/lib/streak/record-action";

function createStreakSupabaseMock(
  initialRow: { actions: string[] } | null = null
) {
  let row = initialRow;

  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: row,
              error: null,
            })),
          })),
        })),
      })),
      insert: jest.fn(async (payload: {
        user_id: string;
        action_date: string;
        actions: string[];
      }) => {
        row = { actions: payload.actions };
        return { error: null };
      }),
      update: jest.fn((payload: { actions: string[] }) => ({
        eq: jest.fn(() => ({
          eq: jest.fn(async () => {
            row = { actions: payload.actions };
            return { error: null };
          }),
        })),
      })),
    })),
    getRow: () => row,
  };
}

describe("recordStreakAction", () => {
  it("inserts a new row when none exists for today", async () => {
    const supabase = createStreakSupabaseMock(null);
    await recordStreakAction(
      "00000000-0000-0000-0000-000000000001",
      "interview_completed",
      supabase as never
    );
    expect(supabase.getRow()?.actions).toEqual(["interview_completed"]);
  });

  it("does not duplicate an action already recorded today", async () => {
    const supabase = createStreakSupabaseMock({
      actions: ["interview_completed"],
    });
    await recordStreakAction(
      "00000000-0000-0000-0000-000000000001",
      "interview_completed",
      supabase as never
    );
    expect(supabase.from().update).not.toHaveBeenCalled();
    expect(supabase.getRow()?.actions).toEqual(["interview_completed"]);
  });

  it("appends a new action to today's row", async () => {
    const supabase = createStreakSupabaseMock({
      actions: ["concept_completed"],
    });
    await recordStreakAction(
      "00000000-0000-0000-0000-000000000001",
      "interview_completed",
      supabase as never
    );
    expect(supabase.getRow()?.actions).toEqual([
      "concept_completed",
      "interview_completed",
    ]);
  });
});

describe("authErrorResponse", () => {
  it("returns Response instances unchanged", () => {
    const response = new Response(null, { status: 403 });
    expect(authErrorResponse(response)).toBe(response);
    expect(authErrorResponse(new Error("boom"))).toBeNull();
  });
});

describe("question-bank", () => {
  it("validateSubMode accepts track-aligned sub-modes", () => {
    expect(validateSubMode("ai_pm", "product_sense")).toBe(true);
    expect(validateSubMode("ai_generalist", "tool_selection")).toBe(true);
    expect(validateSubMode("ai_pm", "tool_selection")).toBe(false);
  });

  it("getOpeningQuestion returns a non-empty string", () => {
    const question = getOpeningQuestion("behavioral");
    expect(question.length).toBeGreaterThan(10);
  });
});
