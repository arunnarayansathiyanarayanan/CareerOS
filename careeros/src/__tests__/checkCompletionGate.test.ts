import { checkCompletionGate } from "@/lib/checkCompletionGate";
import type { RoadmapItem } from "@/types/roadmap";

function item(
  overrides: Partial<RoadmapItem> & Pick<RoadmapItem, "type">
): RoadmapItem {
  return {
    id: "item-1",
    roadmapId: "roadmap-1",
    phase: "Phase 1",
    phaseOrder: 0,
    itemOrder: 0,
    title: "Test item",
    description: "x".repeat(100),
    estimatedHours: 1,
    difficulty: 1,
    dependencies: [],
    status: "in_progress",
    userNote: null,
    externalLinks: [],
    proofOfWorkUrl: null,
    techStack: [],
    completionChecklist: {},
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as RoadmapItem;
}

describe("checkCompletionGate", () => {
  it("blocks projects without proof-of-work URL", () => {
    const result = checkCompletionGate(
      item({ type: "project", proofOfWorkUrl: null }),
      []
    );
    expect(result).toEqual({
      allowed: false,
      reason:
        "Projects require a proof-of-work link before marking complete.",
    });
  });

  it("blocks projects with whitespace-only proof URL", () => {
    const result = checkCompletionGate(
      item({ type: "project", proofOfWorkUrl: "   " }),
      []
    );
    expect(result.allowed).toBe(false);
  });

  it("blocks projects with short description after proof check", () => {
    const result = checkCompletionGate(
      item({
        type: "project",
        proofOfWorkUrl: "https://example.com",
        description: "short",
      }),
      []
    );
    expect(result).toEqual({
      allowed: false,
      reason: "Project description must be at least 100 characters.",
    });
  });

  it("blocks when a dependency is not_started", () => {
    const dep = item({
      id: "dep-1",
      type: "concept",
      title: "Learn basics",
      status: "not_started",
    });
    const current = item({
      type: "milestone",
      dependencies: ["dep-1"],
    });
    const result = checkCompletionGate(current, [current, dep]);
    expect(result).toEqual({
      allowed: false,
      reason: 'Complete "Learn basics" first.',
    });
  });

  it("allows when gates pass", () => {
    const dep = item({
      id: "dep-1",
      type: "concept",
      status: "completed",
    });
    const current = item({
      type: "project",
      proofOfWorkUrl: "https://github.com/a/b",
      dependencies: ["dep-1"],
    });
    expect(checkCompletionGate(current, [current, dep])).toEqual({
      allowed: true,
    });
  });
});
