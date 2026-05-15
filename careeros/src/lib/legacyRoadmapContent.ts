import { randomUUID } from "crypto";
import { z } from "zod";

import { groupRoadmapItems } from "@/lib/groupRoadmapPhases";
import { targetRoleFromOnboardingSelection } from "@/lib/mapOnboardingTargetRole";
import type { RoadmapContent } from "@/services/roadmapGenerator";
import type { GroupedRoadmap, Roadmap, RoadmapItem, TargetRole } from "@/types/roadmap";

const legacyContentSchema = z.object({
  meta: z.object({
    targetRole: z.string(),
    aiNativeReadyScore: z.number().int().min(0).max(100),
    estimatedWeeksToReady: z.number().nonnegative(),
    phase: z.enum(["foundation", "building", "shipping"]),
  }),
  phases: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        items: z.array(z.record(z.string(), z.unknown())).min(1),
      })
    )
    .min(1),
});

export function parseLegacyRoadmapContent(raw: unknown): RoadmapContent | null {
  const result = legacyContentSchema.safeParse(raw);
  if (!result.success) return null;
  return result.data as RoadmapContent;
}

type LegacyItem = RoadmapContent["phases"][number]["items"][number];

function defaultChecklist() {
  return {
    deployedLink: false,
    githubRepo: false,
    loomDemo: false,
    writeUp: false,
  };
}

function legacyItemToRoadmapItem(
  roadmapId: string,
  phaseName: string,
  phaseOrder: number,
  itemOrder: number,
  item: LegacyItem,
  id: string,
  dependencies: string[]
): RoadmapItem {
  const now = new Date();
  const base: RoadmapItem = {
    id,
    roadmapId,
    type: item.type,
    phase: phaseName,
    phaseOrder,
    itemOrder,
    title: item.title,
    description: item.description,
    estimatedHours: item.estimatedHours,
    difficulty: item.difficulty,
    dependencies,
    status: item.status,
    userNote: null,
    externalLinks: [],
    proofOfWorkUrl: null,
    techStack: [],
    completionChecklist: defaultChecklist(),
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  if (item.type === "concept") {
    return {
      ...base,
      externalLinks: item.resources.map((r) => ({
        label: r.title,
        url: r.url,
        type: r.type,
      })),
    };
  }

  if (item.type === "project") {
    return {
      ...base,
      techStack: item.techStack,
    };
  }

  return base;
}

/** Builds a dashboard-ready roadmap from legacy JSONB `content` (read-only display). */
export function groupedRoadmapFromLegacyContent(
  userId: string,
  content: RoadmapContent,
  targetRole: TargetRole,
  roadmapId?: string
): GroupedRoadmap {
  const slugToUuid = new Map<string, string>();
  const items: RoadmapItem[] = [];
  const resolvedRoadmapId = roadmapId ?? randomUUID();

  content.phases.forEach((phase, phaseIndex) => {
    const phaseOrder = phaseIndex + 1;
    phase.items.forEach((item, itemIndex) => {
      slugToUuid.set(item.id, randomUUID());
    });
  });

  content.phases.forEach((phase, phaseIndex) => {
    const phaseOrder = phaseIndex + 1;
    phase.items.forEach((item, itemIndex) => {
      const id = slugToUuid.get(item.id)!;
      const dependencies = item.dependencies
        .map((dep) => slugToUuid.get(dep))
        .filter((depId): depId is string => Boolean(depId));

      items.push(
        legacyItemToRoadmapItem(
          resolvedRoadmapId,
          phase.name,
          phaseOrder,
          itemIndex + 1,
          item,
          id,
          dependencies
        )
      );
    });
  });

  const roadmap: Roadmap = {
    id: resolvedRoadmapId,
    userId,
    targetRole,
    version: 1,
    aiNativeReadyScore: content.meta.aiNativeReadyScore,
    generatedAt: new Date(),
    lastRegenAt: null,
    status: "active",
  };

  return groupRoadmapItems(roadmap, items);
}

export function targetRoleForLegacySync(
  profileTargetRole: string | null | undefined
): TargetRole {
  return targetRoleFromOnboardingSelection(profileTargetRole);
}
