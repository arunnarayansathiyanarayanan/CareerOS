import { calculateAiNativeReadyScore } from "@/lib/calculateAiNativeReadyScore";
import {
  deleteOrphanActiveRoadmap,
  getActiveRoadmapWithItems,
} from "@/lib/roadmapPersistenceHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateRoadmap } from "@/services/generateRoadmap";
import { persistGenerationResultSupabase } from "@/services/persistNormalizedRoadmapSupabase";
import type {
  GenerateRoadmapInput,
  RoadmapGenerationResult,
  RoadmapItem,
  TargetRole,
} from "@/types/roadmap";

function flattenGeneratedItems(
  generated: RoadmapGenerationResult
): RoadmapGenerationResult["phases"][number]["items"][number][] {
  return generated.phases.flatMap((phase) => phase.items);
}

export type GenerateAndPersistResult = {
  roadmapId: string;
  aiNativeReadyScore: number;
  phaseCount: number;
  totalItems: number;
};

/** Generates via OpenAI and persists to Supabase (no `DATABASE_URL` required). */
export async function generateAndPersistRoadmap(
  input: GenerateRoadmapInput
): Promise<GenerateAndPersistResult> {
  const supabase = getSupabaseAdmin();
  await deleteOrphanActiveRoadmap(supabase, input.userId);

  const existing = await getActiveRoadmapWithItems(supabase, input.userId);
  if (existing) {
    const { data: roadmap } = await supabase
      .from("roadmaps")
      .select("ai_native_ready_score")
      .eq("id", existing.roadmapId)
      .single();

    return {
      roadmapId: existing.roadmapId,
      aiNativeReadyScore: Number(roadmap?.ai_native_ready_score ?? 0),
      phaseCount: 0,
      totalItems: existing.itemCount,
    };
  }

  const generated = await generateRoadmap(input);
  const flatItems = flattenGeneratedItems(generated);
  const aiNativeReadyScore = calculateAiNativeReadyScore(
    flatItems as RoadmapItem[]
  );

  const roadmapId = await persistGenerationResultSupabase(
    input.userId,
    input.targetRole as TargetRole,
    generated,
    aiNativeReadyScore
  );

  return {
    roadmapId,
    aiNativeReadyScore,
    phaseCount: generated.phases.length,
    totalItems: flatItems.length,
  };
}
