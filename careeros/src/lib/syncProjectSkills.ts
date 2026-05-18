import { and, eq, ilike, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  skillOntology,
  skillOntologyRequests,
  userSkillGraph,
} from "@/db/schema/skillIntelligence";

const PROJECT_TAG_PROFICIENCY = 3;

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function normalizeStackItem(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function findOntologySkillId(stackItem: string): Promise<string | null> {
  const db = getDb();
  const pattern = `%${escapeIlikePattern(stackItem)}%`;

  const [row] = await db
    .select({ id: skillOntology.id })
    .from(skillOntology)
    .where(
      and(
        eq(skillOntology.isActive, true),
        or(
          ilike(skillOntology.name, pattern),
          ilike(skillOntology.slug, pattern),
          sql`EXISTS (
            SELECT 1
            FROM unnest(${skillOntology.aliases}) AS alias
            WHERE alias ILIKE ANY (ARRAY[${pattern}]::text[])
          )`,
        ),
      ),
    )
    .limit(1);

  return row?.id ?? null;
}

async function upsertProjectTagSkill(
  userId: string,
  skillId: string,
): Promise<void> {
  const db = getDb();

  await db
    .insert(userSkillGraph)
    .values({
      userId,
      skillId,
      source: "project_tag",
      proficiency: PROJECT_TAG_PROFICIENCY,
    })
    .onConflictDoUpdate({
      target: [userSkillGraph.userId, userSkillGraph.skillId],
      set: {
        proficiency: sql`GREATEST(${userSkillGraph.proficiency}, ${PROJECT_TAG_PROFICIENCY})`,
        updatedAt: new Date(),
      },
    });
}

async function logOntologyRequest(
  skillName: string,
  userId: string,
  projectId: string,
): Promise<void> {
  const db = getDb();
  await db.insert(skillOntologyRequests).values({
    skillName,
    userId,
    projectId,
  });
}

/**
 * Maps a project's declared AI stack to `user_skill_graph` via ontology fuzzy-match.
 * Unmatched labels are queued in `skill_ontology_requests`. Never throws.
 */
export async function syncProjectSkills(
  projectId: string,
  userId: string,
  declaredStack: string[],
): Promise<void> {
  try {
    const seen = new Set<string>();

    for (const raw of declaredStack) {
      if (typeof raw !== "string") continue;

      const stackItem = normalizeStackItem(raw);
      if (!stackItem) continue;

      const dedupeKey = stackItem.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      try {
        const skillId = await findOntologySkillId(stackItem);

        if (skillId) {
          await upsertProjectTagSkill(userId, skillId);
          continue;
        }

        await logOntologyRequest(stackItem, userId, projectId);
      } catch (itemError) {
        console.error(
          `[syncProjectSkills] failed for stack item "${stackItem}" (project=${projectId})`,
          itemError,
        );
      }
    }
  } catch (error) {
    console.error(
      `[syncProjectSkills] failed (project=${projectId}, user=${userId})`,
      error,
    );
  }
}
