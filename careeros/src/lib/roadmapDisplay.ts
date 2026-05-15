import type { RoadmapItem, RoadmapPhase } from "@/types/roadmap";

export type RoadmapTypeFilter = "all" | "learn" | "build" | "ship";

export const ROADMAP_TYPE_FILTERS: {
  id: RoadmapTypeFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "learn", label: "Learn" },
  { id: "build", label: "Build" },
  { id: "ship", label: "Ship" },
];

const FILTER_ITEM_TYPE: Record<
  Exclude<RoadmapTypeFilter, "all">,
  RoadmapItem["type"]
> = {
  learn: "concept",
  build: "project",
  ship: "milestone",
};

export const ITEM_TYPE_FILTER_LABEL: Record<RoadmapItem["type"], string> = {
  concept: "Learn",
  project: "Build",
  milestone: "Ship",
};

export function filterItemsByType(
  items: RoadmapItem[],
  filter: RoadmapTypeFilter
): RoadmapItem[] {
  if (filter === "all") return items;
  return items.filter((item) => item.type === FILTER_ITEM_TYPE[filter]);
}

export function filterPhases(
  phases: RoadmapPhase[],
  filter: RoadmapTypeFilter
): RoadmapPhase[] {
  return phases
    .map((phase) => ({
      ...phase,
      items: filterItemsByType(phase.items, filter),
    }))
    .filter((phase) => phase.items.length > 0);
}

export function phaseCompletionPercent(items: RoadmapItem[]): number {
  if (items.length === 0) return 0;
  const completed = items.filter((item) => item.status === "completed").length;
  return Math.round((completed / items.length) * 100);
}
