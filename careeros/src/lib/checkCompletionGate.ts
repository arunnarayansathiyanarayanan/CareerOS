import type { CompletionGateResult, RoadmapItem } from "@/types/roadmap";

export function checkCompletionGate(
  item: RoadmapItem,
  allItems: RoadmapItem[]
): CompletionGateResult {
  if (
    item.type === "project" &&
    (!item.proofOfWorkUrl || item.proofOfWorkUrl.trim() === "")
  ) {
    return {
      allowed: false,
      reason:
        "Projects require a proof-of-work link before marking complete.",
    };
  }

  if (item.type === "project" && item.description.length < 100) {
    return {
      allowed: false,
      reason: "Project description must be at least 100 characters.",
    };
  }

  if (item.dependencies.length > 0) {
    const byId = new Map(allItems.map((i) => [i.id, i]));
    for (const depId of item.dependencies) {
      const dep = byId.get(depId);
      if (dep?.status === "not_started") {
        return {
          allowed: false,
          reason: `Complete "${dep.title}" first.`,
        };
      }
    }
  }

  return { allowed: true };
}
