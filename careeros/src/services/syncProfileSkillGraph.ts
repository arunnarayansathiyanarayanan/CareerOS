import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { SKILL_ONTOLOGY } from "@/constants/skill-ontology";
import { getDb } from "@/db";
import { profiles, skillGraphEntries } from "@/db/schema/profile";
import { projects } from "@/db/schema/projects";

const SKILL_SET = new Set<string>(SKILL_ONTOLOGY);

function filterOntologySkills(skills: string[] | null | undefined): string[] {
  if (!skills?.length) return [];
  const out: string[] = [];
  for (const raw of skills) {
    if (typeof raw !== "string") continue;
    const skill = raw.trim();
    if (!skill || !SKILL_SET.has(skill)) continue;
    if (out.includes(skill)) continue;
    out.push(skill);
  }
  return out;
}

/**
 * Upsert `PROJECT_TAG` rows into `skill_graph_entries` (keeps existing endorsements).
 */
export async function syncProfileSkillGraphFromStacks(
  userId: string,
  stacks: string[][]
): Promise<string | null> {
  const merged = new Set<string>();
  for (const stack of stacks) {
    for (const skill of filterOntologySkills(stack)) {
      merged.add(skill);
    }
  }
  if (merged.size === 0) return null;

  const db = getDb();
  const [prof] = await db
    .select({ id: profiles.id, username: profiles.username })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!prof) return null;

  for (const skill of merged) {
    await db
      .insert(skillGraphEntries)
      .values({
        profileId: prof.id,
        skill,
        source: "PROJECT_TAG",
      })
      .onConflictDoUpdate({
        target: [skillGraphEntries.profileId, skillGraphEntries.skill],
        set: {
          source: sql`CASE
            WHEN ${skillGraphEntries.source} = 'ENDORSEMENT'::skill_graph_source
            THEN ${skillGraphEntries.source}
            ELSE 'PROJECT_TAG'::skill_graph_source
          END`,
          updatedAt: new Date(),
        },
      });
  }

  revalidateTag(`profile:${prof.username.toLowerCase()}`);
  return prof.username;
}

/** Backfill skill graph from all published public/unlisted projects for a user. */
export async function reconcileProfileSkillGraphFromPublishedProjects(
  userId: string
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({
      aiStack: projects.aiStack,
      autoTags: projects.autoTags,
    })
    .from(projects)
    .where(
      and(
        eq(projects.userId, userId),
        eq(projects.isDeleted, false),
        isNotNull(projects.publishedAt),
        inArray(projects.privacyMode, ["public", "unlisted"])
      )
    );

  const stacks = rows.map((r) => [
    ...(r.aiStack ?? []),
    ...(r.autoTags ?? []),
  ]);
  return syncProfileSkillGraphFromStacks(userId, stacks);
}

/**
 * When nothing is pinned yet, pin the first published public/unlisted project.
 */
export async function maybeAutoPinFirstPublishedProject(
  userId: string,
  projectId: string,
  privacyMode: string
): Promise<void> {
  if (privacyMode !== "public" && privacyMode !== "unlisted") return;

  const db = getDb();
  const [prof] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      pinnedProjectIds: profiles.pinnedProjectIds,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!prof || (prof.pinnedProjectIds?.length ?? 0) > 0) return;

  await db
    .update(profiles)
    .set({
      pinnedProjectIds: [projectId],
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, prof.id));

  revalidateTag(`profile:${prof.username.toLowerCase()}`);
}
