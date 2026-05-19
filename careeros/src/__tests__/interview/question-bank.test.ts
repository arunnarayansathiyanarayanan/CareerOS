import { describe, expect, it } from "vitest";

import {
  buildSystemPrompt,
  validateSubMode,
  type InterviewProject,
} from "@/lib/ai/question-bank";

const sampleProjects: InterviewProject[] = [
  {
    name: "Aihired Portfolio",
    stack: ["Next.js", "Supabase"],
    outcome: "Shipped public profiles",
    description: "Proof-of-work builder for AI-native roles",
  },
];

describe("validateSubMode", () => {
  it("accepts valid track and sub-mode pairs", () => {
    expect(validateSubMode("ai_pm", "product_sense")).toBe(true);
    expect(validateSubMode("ai_generalist", "tool_selection")).toBe(true);
  });

  it("rejects invalid combinations", () => {
    expect(validateSubMode("ai_pm", "tool_selection")).toBe(false);
    expect(validateSubMode("ai_generalist", "behavioral")).toBe(false);
    expect(validateSubMode("ai_pm", "not_a_mode")).toBe(false);
  });
});

describe("buildSystemPrompt", () => {
  it("includes project name and turn info without undefined placeholders", () => {
    const prompt = buildSystemPrompt(
      "product_sense",
      sampleProjects,
      2,
      8
    );

    expect(prompt).toContain("Aihired Portfolio");
    expect(prompt).toContain("turn 2 of 8");
    expect(prompt).not.toContain("undefined");
    expect(prompt).not.toMatch(/\$\{[^}]+\}/);
  });

  it("includes opening question guidance on turn 1", () => {
    const prompt = buildSystemPrompt(
      "behavioral",
      sampleProjects,
      1,
      6
    );

    expect(prompt).toContain("turn 1 of 6");
    expect(prompt).toContain("Opening question");
  });
});
