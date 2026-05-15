import type {
  Roadmap as DrizzleRoadmap,
  RoadmapItem as DrizzleRoadmapItem,
  RoadmapTargetRole,
} from "@/db/schema/roadmap";

export type TargetRole = RoadmapTargetRole;

export type RoadmapItemType = "concept" | "project" | "milestone";

export type RoadmapItemStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

export type RoadmapItem = DrizzleRoadmapItem;

export type Roadmap = DrizzleRoadmap;

export type RoadmapPhase = {
  name: string;
  phaseOrder: number;
  items: RoadmapItem[];
};

export type GroupedRoadmap = {
  roadmap: Roadmap;
  phases: RoadmapPhase[];
};

export type GenerateRoadmapInput = {
  userId: string;
  targetRole: TargetRole;
  currentRole: string;
  yearsExperience: string;
  aiFluency: string;
  existingSkills?: string[];
};

export type RoadmapGenerationResult = {
  phases: {
    name: string;
    phaseOrder: number;
    items: Omit<
      RoadmapItem,
      "id" | "roadmapId" | "createdAt" | "updatedAt"
    >[];
  }[];
};

export type CompletionGateResult = {
  allowed: boolean;
  reason?: string;
};

export type RoadmapGenerationErrorCode =
  | "PARSE_FAIL"
  | "TIMEOUT"
  | "QUOTA";

export class RoadmapGenerationError extends Error {
  readonly code: RoadmapGenerationErrorCode;

  constructor(code: RoadmapGenerationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "RoadmapGenerationError";
    this.code = code;
  }
}
