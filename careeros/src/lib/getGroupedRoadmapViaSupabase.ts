import { groupRoadmapItems } from "@/lib/groupRoadmapPhases";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  RoadmapItemStatus,
  RoadmapItemType,
  RoadmapStatus,
  RoadmapTargetRole,
} from "@/db/schema/roadmap";
import type { GroupedRoadmap, Roadmap, RoadmapItem } from "@/types/roadmap";

function mapRoadmapRow(row: Record<string, unknown>): Roadmap {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    targetRole: row.target_role as RoadmapTargetRole,
    version: Number(row.version ?? 1),
    aiNativeReadyScore: Number(row.ai_native_ready_score ?? 0),
    generatedAt: new Date(String(row.generated_at)),
    lastRegenAt:
      row.last_regen_at != null ? new Date(String(row.last_regen_at)) : null,
    updatedAt:
      row.updated_at != null
        ? new Date(String(row.updated_at))
        : new Date(String(row.generated_at)),
    status: (row.status as RoadmapStatus) ?? "active",
  };
}

function mapItemRow(row: Record<string, unknown>): RoadmapItem {
  return {
    id: String(row.id),
    roadmapId: String(row.roadmap_id),
    type: row.type as RoadmapItemType,
    phase: String(row.phase),
    phaseOrder: Number(row.phase_order),
    itemOrder: Number(row.item_order),
    title: String(row.title),
    description: String(row.description),
    estimatedHours: Number(row.estimated_hours),
    difficulty: Number(row.difficulty),
    dependencies: Array.isArray(row.dependencies)
      ? (row.dependencies as string[])
      : [],
    status: row.status as RoadmapItemStatus,
    userNote: row.user_note != null ? String(row.user_note) : null,
    externalLinks: Array.isArray(row.external_links)
      ? (row.external_links as RoadmapItem["externalLinks"])
      : [],
    proofOfWorkUrl:
      row.proof_of_work_url != null ? String(row.proof_of_work_url) : null,
    techStack: Array.isArray(row.tech_stack)
      ? (row.tech_stack as string[])
      : [],
    completionChecklist:
      row.completion_checklist != null &&
      typeof row.completion_checklist === "object"
        ? (row.completion_checklist as RoadmapItem["completionChecklist"])
        : {},
    completedAt:
      row.completed_at != null ? new Date(String(row.completed_at)) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

async function loadNormalizedGrouped(
  userId: string
): Promise<GroupedRoadmap | null> {
  const supabase = getSupabaseAdmin();

  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "stale"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roadmapError || !roadmap) return null;

  const { data: itemRows, error: itemsError } = await supabase
    .from("roadmap_items")
    .select("*")
    .eq("roadmap_id", roadmap.id)
    .order("phase_order", { ascending: true })
    .order("item_order", { ascending: true });

  if (itemsError || !itemRows?.length) return null;

  return groupRoadmapItems(
    mapRoadmapRow(roadmap as Record<string, unknown>),
    itemRows.map((row) => mapItemRow(row as Record<string, unknown>))
  );
}

/** Loads the active roadmap via Supabase (no `DATABASE_URL` required). */
export async function getGroupedRoadmapViaSupabase(
  clerkId: string
): Promise<GroupedRoadmap | null> {
  const supabase = getSupabaseAdmin();

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (userError || !userRow || typeof userRow.id !== "string") {
    return null;
  }

  return loadNormalizedGrouped(userRow.id);
}
