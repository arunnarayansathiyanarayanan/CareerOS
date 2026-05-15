import { calculateAiNativeReadyScore } from "@/lib/calculateAiNativeReadyScore";
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

  const { data: existing } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .maybeSingle();

  if (existing?.id) {
    return {
      roadmapId: existing.id as string,
      aiNativeReadyScore: 0,
      phaseCount: 0,
      totalItems: 0,
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
