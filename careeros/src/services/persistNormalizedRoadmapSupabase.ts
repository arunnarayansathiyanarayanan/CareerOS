import { randomUUID } from "crypto";

import { targetRoleFromOnboardingSelection } from "@/lib/mapOnboardingTargetRole";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { RoadmapContent } from "@/services/roadmapGenerator";
import type {
  RoadmapGenerationResult,
  TargetRole,
} from "@/types/roadmap";

type LegacyItem = RoadmapContent["phases"][number]["items"][number];

function defaultChecklist() {
  return {
    deployedLink: false,
    githubRepo: false,
    loomDemo: false,
    writeUp: false,
  };
}

function legacyItemToRow(
  roadmapId: string,
  phaseName: string,
  phaseOrder: number,
  itemOrder: number,
  item: LegacyItem,
  id: string,
  dependencies: string[]
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id,
    roadmap_id: roadmapId,
    type: item.type,
    phase: phaseName,
    phase_order: phaseOrder,
    item_order: itemOrder,
    title: item.title,
    description: item.description,
    estimated_hours: item.estimatedHours,
    difficulty: item.difficulty,
    dependencies,
    status: item.status,
    user_note: null,
    external_links: [],
    proof_of_work_url: null,
    tech_stack: [],
    completion_checklist: defaultChecklist(),
    completed_at: null,
  };

  if (item.type === "concept") {
    base.external_links = item.resources.map((r) => ({
      label: r.title,
      url: r.url,
      type: r.type,
    }));
  }

  if (item.type === "project") {
    base.tech_stack = item.techStack;
  }

  return base;
}

/**
 * Persists legacy-shaped roadmap content into normalized `roadmaps` + `roadmap_items`.
 */
export async function persistNormalizedRoadmapSupabase(
  userId: string,
  content: RoadmapContent,
  targetRole?: TargetRole
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const role =
    targetRole ??
    targetRoleFromOnboardingSelection(content.meta.targetRole);

  const { data: existing } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (existing?.id) {
    return existing.id as string;
  }

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

  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .insert({
      user_id: userId,
      target_role: role,
      ai_native_ready_score: content.meta.aiNativeReadyScore,
      status: "active",
    })
    .select("id")
    .single();

  if (roadmapError || !roadmap?.id) {
    throw roadmapError ?? new Error("Roadmap insert returned no row");
  }

  const roadmapId = roadmap.id as string;
  const itemRows = flat.map((row) => {
    const id = slugToUuid.get(row.slug)!;
    const dependencies = row.item.dependencies
      .map((dep) => slugToUuid.get(dep))
      .filter((depId): depId is string => Boolean(depId));

    return legacyItemToRow(
      roadmapId,
      row.phaseName,
      row.phaseOrder,
      row.itemOrder,
      row.item,
      id,
      dependencies
    );
  });

  const { error: itemsError } = await supabase
    .from("roadmap_items")
    .insert(itemRows);

  if (itemsError) {
    await supabase.from("roadmaps").delete().eq("id", roadmapId);
    throw itemsError;
  }

  return roadmapId;
}

/** Persists OpenAI `generateRoadmap` output into normalized tables. */
export async function persistGenerationResultSupabase(
  userId: string,
  targetRole: TargetRole,
  generated: RoadmapGenerationResult,
  aiNativeReadyScore: number
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (existing?.id) {
    return existing.id as string;
  }

  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .insert({
      user_id: userId,
      target_role: targetRole,
      ai_native_ready_score: aiNativeReadyScore,
      status: "active",
    })
    .select("id")
    .single();

  if (roadmapError || !roadmap?.id) {
    throw roadmapError ?? new Error("Roadmap insert returned no row");
  }

  const roadmapId = roadmap.id as string;
  const itemRows = generated.phases.flatMap((phase) =>
    phase.items.map((item) => ({
      roadmap_id: roadmapId,
      type: item.type,
      phase: item.phase,
      phase_order: item.phaseOrder,
      item_order: item.itemOrder,
      title: item.title,
      description: item.description,
      estimated_hours: item.estimatedHours,
      difficulty: item.difficulty,
      dependencies: item.dependencies,
      status: item.status,
      user_note: item.userNote,
      external_links: item.externalLinks,
      proof_of_work_url: item.proofOfWorkUrl,
      tech_stack: item.techStack,
      completion_checklist: item.completionChecklist,
      completed_at: item.completedAt,
    }))
  );

  const { error: itemsError } = await supabase
    .from("roadmap_items")
    .insert(itemRows);

  if (itemsError) {
    await supabase.from("roadmaps").delete().eq("id", roadmapId);
    throw itemsError;
  }

  return roadmapId;
}
