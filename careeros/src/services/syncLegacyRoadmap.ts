import { randomUUID } from "crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { roadmapItems, roadmaps } from "@/db/schema/roadmap";
import {
  parseLegacyRoadmapContent,
  targetRoleForLegacySync,
} from "@/lib/legacyRoadmapContent";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { RoadmapContent } from "@/lib/legacyRoadmapJson";
import type { TargetRole } from "@/types/roadmap";

function defaultChecklist() {
  return {
    deployedLink: false,
    githubRepo: false,
    loomDemo: false,
    writeUp: false,
  };
}

type LegacyItem = RoadmapContent["phases"][number]["items"][number];

function legacyItemToInsert(
  roadmapId: string,
  phaseName: string,
  phaseOrder: number,
  itemOrder: number,
  item: LegacyItem,
  id: string,
  dependencies: string[]
): typeof roadmapItems.$inferInsert {
  const base = {
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
    externalLinks: [] as {
      label: string;
      url: string;
      type: "youtube" | "blog" | "docs";
    }[],
    proofOfWorkUrl: null,
    techStack: [] as string[],
    completionChecklist: defaultChecklist(),
    completedAt: null,
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

/**
 * Copies legacy JSONB `roadmaps.content` into normalized Drizzle tables.
 * Requires `DATABASE_URL`.
 */
export async function syncLegacyRoadmapToNormalized(
  userId: string
): Promise<boolean> {
  const db = getDb();

  const [existing] = await db
    .select({ id: roadmaps.id })
    .from(roadmaps)
    .where(and(eq(roadmaps.userId, userId), eq(roadmaps.status, "active")))
    .limit(1);

  if (existing) return true;

  const supabase = getSupabaseAdmin();

  const { data: legacy, error: legacyError } = await supabase
    .from("roadmaps")
    .select("content")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();

  if (legacyError || !legacy?.content) {
    return false;
  }

  const content = parseLegacyRoadmapContent(legacy.content);
  if (!content) return false;

  const { data: profile } = await supabase
    .from("onboarding_profiles")
    .select("target_role")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const targetRole: TargetRole = targetRoleForLegacySync(
    profile?.target_role as string | undefined
  );

  const slugToUuid = new Map<string, string>();
  const flat: {
    phaseName: string;
    phaseOrder: number;
    itemOrder: number;
    item: LegacyItem;
    slug: string;
  }[] = [];

  content.phases.forEach((phase, phaseIndex) => {
    const phaseOrder = phaseIndex + 1;
    phase.items.forEach((item, itemIndex) => {
      const slug = item.id;
      slugToUuid.set(slug, randomUUID());
      flat.push({
        phaseName: phase.name,
        phaseOrder,
        itemOrder: itemIndex + 1,
        item,
        slug,
      });
    });
  });

  await db.transaction(async (tx) => {
    const [roadmap] = await tx
      .insert(roadmaps)
      .values({
        userId,
        targetRole,
        aiNativeReadyScore: content.meta.aiNativeReadyScore,
        status: "active",
      })
      .returning({ id: roadmaps.id });

    if (!roadmap) {
      throw new Error("Roadmap insert returned no row");
    }

    for (const row of flat) {
      const id = slugToUuid.get(row.slug)!;
      const dependencies = row.item.dependencies
        .map((dep) => slugToUuid.get(dep))
        .filter((depId): depId is string => Boolean(depId));

      await tx.insert(roadmapItems).values(
        legacyItemToInsert(
          roadmap.id,
          row.phaseName,
          row.phaseOrder,
          row.itemOrder,
          row.item,
          id,
          dependencies
        )
      );
    }
  });

  return true;
}
