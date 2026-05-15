import { and, desc, eq } from "drizzle-orm";

import type { DrizzleDB } from "@/db/types";
import { onboardingProfiles } from "@/db/schema/onboarding";
import { roadmapItems, roadmaps } from "@/db/schema/roadmap";
import { calculateAiNativeReadyScore } from "@/lib/calculateAiNativeReadyScore";
import { generateRoadmap } from "@/services/generateRoadmap";
import type {
  GenerateRoadmapInput,
  RoadmapGenerationResult,
  RoadmapItem,
} from "@/types/roadmap";

type GeneratedItem =
  RoadmapGenerationResult["phases"][number]["items"][number];

type ScoreItem = Pick<RoadmapItem, "type" | "status" | "proofOfWorkUrl">;

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function resumeSkills(resumeParsed: unknown): string[] | undefined {
  if (resumeParsed === null || resumeParsed === undefined) return undefined;
  if (typeof resumeParsed !== "object" || Array.isArray(resumeParsed)) {
    return undefined;
  }
  const skills = (resumeParsed as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return undefined;
  return skills.filter((s): s is string => typeof s === "string" && s.length > 0);
}

async function fetchProfileForGeneration(
  db: DrizzleDB,
  userId: string
): Promise<Omit<GenerateRoadmapInput, "userId" | "targetRole">> {
  const [profile] = await db
    .select({
      currentRole: onboardingProfiles.currentRole,
      yearsOfExperience: onboardingProfiles.yearsOfExperience,
      aiFluency: onboardingProfiles.aiFluency,
      resumeParsed: onboardingProfiles.resumeParsed,
    })
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, userId))
    .orderBy(desc(onboardingProfiles.createdAt))
    .limit(1);

  const skills = resumeSkills(profile?.resumeParsed);

  return {
    currentRole: profile?.currentRole?.trim() || "Not specified",
    yearsExperience: profile?.yearsOfExperience?.trim() || "Not specified",
    aiFluency: profile?.aiFluency?.trim() || "not_started",
    ...(skills?.length ? { existingSkills: skills } : {}),
  };
}

async function markRoadmapStale(db: DrizzleDB, roadmapId: string): Promise<void> {
  try {
    await db
      .update(roadmaps)
      .set({ status: "stale" })
      .where(eq(roadmaps.id, roadmapId));
  } catch (markError) {
    console.error("[regenerateRoadmap] failed to mark roadmap stale:", markError);
  }
}

function buildMergedItemsForScore(
  oldItems: RoadmapItem[],
  generatedPhases: RoadmapGenerationResult["phases"],
  matchedOldIds: Set<string>
): ScoreItem[] {
  const oldByTitle = new Map(
    oldItems.map((item) => [normalizeTitle(item.title), item])
  );
  const merged: ScoreItem[] = [];

  for (const phase of generatedPhases) {
    for (const newItem of phase.items) {
      const old = oldByTitle.get(normalizeTitle(newItem.title));
      if (old) {
        merged.push({
          type: newItem.type,
          status: old.status,
          proofOfWorkUrl: old.proofOfWorkUrl,
        });
      } else {
        merged.push({
          type: newItem.type,
          status: "not_started",
          proofOfWorkUrl: null,
        });
      }
    }
  }

  for (const old of oldItems) {
    if (!matchedOldIds.has(old.id)) {
      merged.push({
        type: old.type,
        status: "skipped",
        proofOfWorkUrl: old.proofOfWorkUrl,
      });
    }
  }

  return merged;
}

function generatedItemToInsert(
  roadmapId: string,
  item: GeneratedItem
): typeof roadmapItems.$inferInsert {
  return {
    roadmapId,
    type: item.type,
    phase: item.phase,
    phaseOrder: item.phaseOrder,
    itemOrder: item.itemOrder,
    title: item.title,
    description: item.description,
    estimatedHours: item.estimatedHours,
    difficulty: item.difficulty,
    dependencies: item.dependencies,
    status: "not_started",
    userNote: item.userNote,
    externalLinks: item.externalLinks,
    proofOfWorkUrl: item.proofOfWorkUrl,
    techStack: item.techStack,
    completionChecklist: item.completionChecklist,
    completedAt: item.completedAt,
  };
}

/**
 * Regenerates the user's active roadmap from current profile data, merging AI output
 * with preserved progress. Failures mark the roadmap `stale` and are logged only.
 */
export async function regenerateRoadmap(
  userId: string,
  db: DrizzleDB
): Promise<boolean> {
  let roadmapId: string | undefined;

  try {
    const [roadmap] = await db
      .select()
      .from(roadmaps)
      .where(and(eq(roadmaps.userId, userId), eq(roadmaps.status, "active")))
      .limit(1);

    if (!roadmap) return true;

    roadmapId = roadmap.id;

    const oldItems = await db
      .select()
      .from(roadmapItems)
      .where(eq(roadmapItems.roadmapId, roadmap.id));

    const profileFields = await fetchProfileForGeneration(db, userId);

    const generated = await generateRoadmap({
      userId,
      targetRole: roadmap.targetRole,
      ...profileFields,
    });

    const oldByTitle = new Map(
      oldItems.map((item) => [normalizeTitle(item.title), item])
    );
    const matchedOldIds = new Set<string>();

    await db.transaction(async (tx) => {
      for (const phase of generated.phases) {
        for (const newItem of phase.items) {
          const old = oldByTitle.get(normalizeTitle(newItem.title));

          if (old) {
            matchedOldIds.add(old.id);
            await tx
              .update(roadmapItems)
              .set({
                type: newItem.type,
                phase: newItem.phase,
                phaseOrder: newItem.phaseOrder,
                itemOrder: newItem.itemOrder,
                title: newItem.title,
                description: newItem.description,
                estimatedHours: newItem.estimatedHours,
                difficulty: newItem.difficulty,
                externalLinks: newItem.externalLinks,
                techStack: newItem.techStack,
                completionChecklist: newItem.completionChecklist,
                status: old.status,
                userNote: old.userNote,
                proofOfWorkUrl: old.proofOfWorkUrl,
                completedAt: old.completedAt,
              })
              .where(eq(roadmapItems.id, old.id));
          } else {
            await tx.insert(roadmapItems).values(
              generatedItemToInsert(roadmap.id, newItem)
            );
          }
        }
      }

      for (const old of oldItems) {
        if (!matchedOldIds.has(old.id)) {
          await tx
            .update(roadmapItems)
            .set({ status: "skipped" })
            .where(eq(roadmapItems.id, old.id));
        }
      }

      const mergedForScore = buildMergedItemsForScore(
        oldItems,
        generated.phases,
        matchedOldIds
      );
      const aiNativeReadyScore = calculateAiNativeReadyScore(
        mergedForScore as RoadmapItem[]
      );
      const now = new Date();

      await tx
        .update(roadmaps)
        .set({
          version: roadmap.version + 1,
          lastRegenAt: now,
          aiNativeReadyScore,
          status: "active",
        })
        .where(eq(roadmaps.id, roadmap.id));
    });

    return true;
  } catch (error) {
    console.error("[regenerateRoadmap] failed:", error);
    if (roadmapId) {
      await markRoadmapStale(db, roadmapId);
    }
    return false;
  }
}
