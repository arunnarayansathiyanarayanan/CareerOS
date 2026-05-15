import type { RoadmapItem } from "@/types/roadmap";

export type AiNativeReadyLabel =
  | "Beginner"
  | "Developing"
  | "Proficient"
  | "AI-Native Ready";

const CONCEPT_WEIGHT = 30;
const PROJECT_WEIGHT = 50;
const MILESTONE_WEIGHT = 20;

function isProjectWithProof(item: RoadmapItem): boolean {
  return (
    item.type === "project" &&
    item.status === "completed" &&
    item.proofOfWorkUrl != null &&
    item.proofOfWorkUrl.trim() !== ""
  );
}

function categoryPoints(
  items: RoadmapItem[],
  type: RoadmapItem["type"],
  maxPoints: number,
  countsAsCompleted: (item: RoadmapItem) => boolean
): number {
  const ofType = items.filter((item) => item.type === type);
  if (ofType.length === 0) return 0;
  const completed = ofType.filter(countsAsCompleted).length;
  return (completed / ofType.length) * maxPoints;
}

export function calculateAiNativeReadyScore(items: RoadmapItem[]): number {
  if (items.length === 0) return 0;

  const conceptPoints = categoryPoints(
    items,
    "concept",
    CONCEPT_WEIGHT,
    (item) => item.status === "completed"
  );
  const projectPoints = categoryPoints(
    items,
    "project",
    PROJECT_WEIGHT,
    isProjectWithProof
  );
  const milestonePoints = categoryPoints(
    items,
    "milestone",
    MILESTONE_WEIGHT,
    (item) => item.status === "completed"
  );

  const raw = conceptPoints + projectPoints + milestonePoints;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function getScoreLabel(score: number): AiNativeReadyLabel {
  if (score >= 80) return "AI-Native Ready";
  if (score >= 50) return "Proficient";
  if (score >= 25) return "Developing";
  return "Beginner";
}

export function countReadinessStats(items: RoadmapItem[]): {
  conceptsDone: number;
  projectsDone: number;
  milestonesDone: number;
} {
  return {
    conceptsDone: items.filter(
      (item) => item.type === "concept" && item.status === "completed"
    ).length,
    projectsDone: items.filter(isProjectWithProof).length,
    milestonesDone: items.filter(
      (item) => item.type === "milestone" && item.status === "completed"
    ).length,
  };
}
