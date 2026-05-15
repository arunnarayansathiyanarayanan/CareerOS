import { eq, sql } from "drizzle-orm";

import { getEdgeDb } from "@/db/edge";
import { profiles } from "@/db/schema/profile";
import { users } from "@/db/schema/users";

export type OgProfileData = {
  username: string;
  displayName: string;
  headline: string | null;
  targetRole: string;
  aiNativeVerified: boolean;
  streakDays: number;
  roadmapProgressPct: number;
  topSkills: string[];
};

function displayNameFromRow(email: string, username: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (local.length >= 2) {
    return local
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return username;
}

/** Single-query public profile bundle for OG image generation (edge). */
export async function loadOgProfileByUsername(
  username: string
): Promise<OgProfileData | null> {
  const db = getEdgeDb();

  const [row] = await db
    .select({
      username: profiles.username,
      headline: profiles.headline,
      targetRole: profiles.targetRole,
      visibility: profiles.visibility,
      aiNativeVerified: profiles.aiNativeVerified,
      streakDays: profiles.streakDays,
      roadmapProgressPct: profiles.roadmapProgressPct,
      email: users.email,
      topSkills: sql<string[]>`(
        SELECT COALESCE(array_agg(skill ORDER BY sort_key DESC, skill ASC), ARRAY[]::varchar[])
        FROM (
          SELECT
            sge.skill,
            (CASE sge.source
              WHEN 'ENDORSEMENT' THEN 3
              WHEN 'PROJECT_TAG' THEN 2
              ELSE 1
            END) * 1000 + COALESCE(sge.proficiency, 0) AS sort_key
          FROM skill_graph_entries sge
          WHERE sge.profile_id = ${profiles.id}
          ORDER BY sort_key DESC, sge.skill ASC
          LIMIT 3
        ) ranked
      )`.as("top_skills"),
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(profiles.username, username))
    .limit(1);

  if (!row || row.visibility === "ANONYMOUS") return null;

  return {
    username: row.username,
    displayName: displayNameFromRow(row.email, row.username),
    headline: row.headline,
    targetRole: row.targetRole,
    aiNativeVerified: row.aiNativeVerified,
    streakDays: row.streakDays,
    roadmapProgressPct: row.roadmapProgressPct,
    topSkills: row.topSkills ?? [],
  };
}
