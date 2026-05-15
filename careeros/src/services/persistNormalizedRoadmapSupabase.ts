import {
  deleteOrphanActiveRoadmap,
  getActiveRoadmapWithItems,
} from "@/lib/roadmapPersistenceHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  RoadmapGenerationResult,
  TargetRole,
} from "@/types/roadmap";

/** Persists OpenAI `generateRoadmap` output into normalized tables. */
export async function persistGenerationResultSupabase(
  userId: string,
  targetRole: TargetRole,
  generated: RoadmapGenerationResult,
  aiNativeReadyScore: number
): Promise<string> {
  const supabase = getSupabaseAdmin();

  await deleteOrphanActiveRoadmap(supabase, userId);

  const existing = await getActiveRoadmapWithItems(supabase, userId);
  if (existing) {
    return existing.roadmapId;
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
