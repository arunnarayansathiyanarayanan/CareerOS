import { eq } from "drizzle-orm";

import { SKILL_ONTOLOGY } from "@/constants/skill-ontology";
import { getDb } from "@/db";
import {
  profiles,
  skillGraphEntries,
  type Profile,
} from "@/db/schema/profile";
import { targetRoleFromOnboardingSelection } from "@/lib/mapOnboardingTargetRole";
import {
  isReservedUsername,
  normalizeUsername,
  validateUsernameFormat,
} from "@/lib/username";

const SKILL_SET = new Set<string>(SKILL_ONTOLOGY);

export type ProvisionPublicProfileInput = {
  userId: string;
  username: string;
  /** Onboarding `target_role` slug or `profiles.target_role` enum value. */
  targetRole: string;
  headline?: string | null;
  skills?: string[];
  roadmapProgressPct?: number;
};

export type ProvisionPublicProfileResult = {
  profileId: string;
  username: string;
  created: boolean;
};

function filterOntologySkills(skills: string[] | undefined): string[] {
  if (!skills?.length) return [];
  const out: string[] = [];
  for (const raw of skills) {
    if (typeof raw !== "string") continue;
    const skill = raw.trim();
    if (!skill || !SKILL_SET.has(skill)) continue;
    if (out.includes(skill)) continue;
    out.push(skill);
    if (out.length >= 20) break;
  }
  return out;
}

/**
 * Create or update the E4 `profiles` row for a user. Required for `/u/[username]`.
 */
export async function provisionPublicProfile(
  input: ProvisionPublicProfileInput
): Promise<ProvisionPublicProfileResult | null> {
  const username = normalizeUsername(input.username);
  const format = validateUsernameFormat(username);
  if (!format.valid || isReservedUsername(username)) {
    return null;
  }

  const targetRole = targetRoleFromOnboardingSelection(
    input.targetRole
  ) as Profile["targetRole"];

  const db = getDb();
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, input.userId))
    .limit(1);

  const progressPct =
    input.roadmapProgressPct !== undefined
      ? Math.max(0, Math.min(100, Math.round(input.roadmapProgressPct)))
      : undefined;

  if (existing) {
    const [updated] = await db
      .update(profiles)
      .set({
        username,
        targetRole,
        ...(input.headline !== undefined ? { headline: input.headline } : {}),
        ...(progressPct !== undefined
          ? { roadmapProgressPct: progressPct }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, existing.id))
      .returning();

    if (!updated) return null;

    await seedDeclaredSkills(updated.id, input.skills);
    return {
      profileId: updated.id,
      username: updated.username,
      created: false,
    };
  }

  const [inserted] = await db
    .insert(profiles)
    .values({
      userId: input.userId,
      username,
      targetRole,
      headline: input.headline ?? null,
      visibility: "PUBLIC",
      ...(progressPct !== undefined
        ? { roadmapProgressPct: progressPct }
        : {}),
    })
    .returning();

  if (!inserted) return null;

  await seedDeclaredSkills(inserted.id, input.skills);

  return {
    profileId: inserted.id,
    username: inserted.username,
    created: true,
  };
}

async function seedDeclaredSkills(
  profileId: string,
  skills: string[] | undefined
): Promise<void> {
  const valid = filterOntologySkills(skills);
  if (valid.length === 0) return;

  const db = getDb();
  for (const skill of valid) {
    try {
      await db.insert(skillGraphEntries).values({
        profileId,
        skill,
        source: "DECLARED",
      });
    } catch {
      /* best-effort seed */
    }
  }
}
