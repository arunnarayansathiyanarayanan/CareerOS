import type { SupabaseClient } from "@supabase/supabase-js";

/** Returns active roadmap id only when it has at least one item row. */
export async function getActiveRoadmapWithItems(
  supabase: SupabaseClient,
  userId: string
): Promise<{ roadmapId: string; itemCount: number } | null> {
  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (roadmapError || !roadmap?.id) return null;

  const roadmapId = roadmap.id as string;
  const { count, error: countError } = await supabase
    .from("roadmap_items")
    .select("id", { count: "exact", head: true })
    .eq("roadmap_id", roadmapId);

  if (countError || !count) return null;

  return { roadmapId, itemCount: count };
}

/** Removes an active roadmap row that has no items (partial failed insert). */
export async function deleteOrphanActiveRoadmap(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (roadmapError || !roadmap?.id) return;

  const roadmapId = roadmap.id as string;
  const { count, error: countError } = await supabase
    .from("roadmap_items")
    .select("id", { count: "exact", head: true })
    .eq("roadmap_id", roadmapId);

  if (countError || count) return;

  await supabase.from("roadmaps").delete().eq("id", roadmapId);
}
