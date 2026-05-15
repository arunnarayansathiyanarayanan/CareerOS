import type {
  GroupedRoadmap,
  Roadmap,
  RoadmapItem,
  RoadmapPhase,
} from "@/types/roadmap";

export function groupRoadmapItems(
  roadmap: Roadmap,
  items: RoadmapItem[]
): GroupedRoadmap {
  const phaseMap = new Map<string, RoadmapPhase>();

  for (const item of items) {
    const key = `${item.phaseOrder}:${item.phase}`;
    let phase = phaseMap.get(key);
    if (!phase) {
      phase = {
        name: item.phase,
        phaseOrder: item.phaseOrder,
        items: [],
      };
      phaseMap.set(key, phase);
    }
    phase.items.push(item);
  }

  const phases = [...phaseMap.values()]
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
    .map((phase) => ({
      ...phase,
      items: [...phase.items].sort((a, b) => a.itemOrder - b.itemOrder),
    }));

  return { roadmap, phases };
}
