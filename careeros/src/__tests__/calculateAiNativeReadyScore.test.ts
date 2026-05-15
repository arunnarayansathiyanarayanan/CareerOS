import {
  calculateAiNativeReadyScore,
  getScoreLabel,
} from "@/lib/calculateAiNativeReadyScore";
import type { RoadmapItem } from "@/types/roadmap";

function item(
  overrides: Partial<RoadmapItem> & Pick<RoadmapItem, "type">
): Pick<RoadmapItem, "type" | "status" | "proofOfWorkUrl"> {
  return {
    status: "not_started",
    proofOfWorkUrl: null,
    ...overrides,
  };
}

describe("calculateAiNativeReadyScore", () => {
  it("returns 0 for empty items", () => {
    expect(calculateAiNativeReadyScore([])).toBe(0);
  });

  it("returns 100 when all categories are fully complete with project proof", () => {
    const items = [
      item({ type: "concept", status: "completed" }),
      item({ type: "concept", status: "completed" }),
      item({
        type: "project",
        status: "completed",
        proofOfWorkUrl: "https://github.com/a/b",
      }),
      item({ type: "milestone", status: "completed" }),
    ];
    expect(calculateAiNativeReadyScore(items)).toBe(100);
  });

  it("does not count completed projects without proofOfWorkUrl", () => {
    const items = [
      item({ type: "concept", status: "completed" }),
      item({ type: "project", status: "completed", proofOfWorkUrl: null }),
      item({ type: "milestone", status: "completed" }),
    ];
    expect(calculateAiNativeReadyScore(items)).toBe(50);
  });

  it("weights concepts, projects, and milestones proportionally", () => {
    const items = [
      item({ type: "concept", status: "completed" }),
      item({ type: "concept", status: "not_started" }),
      item({
        type: "project",
        status: "completed",
        proofOfWorkUrl: "https://example.com",
      }),
      item({ type: "project", status: "not_started" }),
      item({ type: "milestone", status: "not_started" }),
      item({ type: "milestone", status: "not_started" }),
    ];
    expect(calculateAiNativeReadyScore(items)).toBe(40);
  });
});

describe("getScoreLabel", () => {
  it.each([
    [0, "Beginner"],
    [24, "Beginner"],
    [25, "Developing"],
    [49, "Developing"],
    [50, "Proficient"],
    [79, "Proficient"],
    [80, "AI-Native Ready"],
    [100, "AI-Native Ready"],
  ] as const)("score %i → %s", (score, label) => {
    expect(getScoreLabel(score)).toBe(label);
  });
});
