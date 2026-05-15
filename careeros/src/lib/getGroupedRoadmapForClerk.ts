import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { roadmapItems, roadmaps } from "@/db/schema/roadmap";
import { users } from "@/db/schema/users";
import { getGroupedRoadmapViaSupabase } from "@/lib/getGroupedRoadmapViaSupabase";
import { groupRoadmapItems } from "@/lib/groupRoadmapPhases";
import { syncLegacyRoadmapToNormalized } from "@/services/syncLegacyRoadmap";
import type { GroupedRoadmap } from "@/types/roadmap";

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function loadActiveGroupedRoadmap(
  userId: string
): Promise<GroupedRoadmap | null> {
  const db = getDb();

  const [roadmap] = await db
    .select()
    .from(roadmaps)
    .where(
      and(
        eq(roadmaps.userId, userId),
        inArray(roadmaps.status, ["active", "stale"])
      )
    )
    .orderBy(desc(roadmaps.updatedAt))
    .limit(1);

  if (!roadmap) return null;

  const items = await db
    .select()
    .from(roadmapItems)
    .where(eq(roadmapItems.roadmapId, roadmap.id))
    .orderBy(asc(roadmapItems.phaseOrder), asc(roadmapItems.itemOrder));

  if (items.length === 0) return null;

  return groupRoadmapItems(roadmap, items);
}

async function getGroupedRoadmapViaDrizzle(
  clerkId: string
): Promise<GroupedRoadmap | null> {
  const db = getDb();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) return null;

  let grouped = await loadActiveGroupedRoadmap(user.id);
  if (grouped) return grouped;

  try {
    const synced = await syncLegacyRoadmapToNormalized(user.id);
    if (synced) {
      grouped = await loadActiveGroupedRoadmap(user.id);
    }
  } catch (error) {
    console.error("[getGroupedRoadmapForClerk] legacy sync failed:", error);
  }

  return grouped;
}

/** Active roadmap for the signed-in Clerk user. Uses Supabase when `DATABASE_URL` is unset. */
export async function getGroupedRoadmapForClerk(
  clerkId: string
): Promise<GroupedRoadmap | null> {
  if (!hasDatabaseUrl()) {
    return getGroupedRoadmapViaSupabase(clerkId);
  }

  try {
    return await getGroupedRoadmapViaDrizzle(clerkId);
  } catch (error) {
    console.error(
      "[getGroupedRoadmapForClerk] Drizzle failed, falling back to Supabase:",
      error
    );
    return getGroupedRoadmapViaSupabase(clerkId);
  }
}
