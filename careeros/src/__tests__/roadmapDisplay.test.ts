import {
  filterPhases,
  phaseCompletionPercent,
} from "@/lib/roadmapDisplay";
import type { RoadmapItem, RoadmapPhase } from "@/types/roadmap";

let idSeq = 0;

function item(
  overrides: Partial<RoadmapItem> & Pick<RoadmapItem, "type" | "status">
): RoadmapItem {
  idSeq += 1;
  return {
    id: `item-${idSeq}`,
    roadmapId: "roadmap-1",
    phase: "Phase 1",
    phaseOrder: 1,
    itemOrder: 1,
    title: "Item",
    description: "Desc",
    estimatedHours: 2,
    difficulty: 2,
    dependencies: [],
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

function phase(items: RoadmapItem[]): RoadmapPhase {
  return { name: "Phase 1", phaseOrder: 1, items };
}

describe("roadmapDisplay", () => {
  it("computes phase completion from completed items only", () => {
    const items = [
      item({ type: "concept", status: "completed" }),
      item({ type: "project", status: "not_started" }),
    ];
    expect(phaseCompletionPercent(items)).toBe(50);
  });

  it("filters phases and items by learn/build/ship", () => {
    const phases = [
      phase([
        item({ type: "concept", status: "not_started" }),
        item({ type: "project", status: "not_started" }),
      ]),
    ];
    const learnOnly = filterPhases(phases, "learn");
    expect(learnOnly).toHaveLength(1);
    expect(learnOnly[0]?.items).toHaveLength(1);
    expect(learnOnly[0]?.items[0]?.type).toBe("concept");

    const emptyShip = filterPhases(phases, "ship");
    expect(emptyShip).toHaveLength(0);
  });
});
