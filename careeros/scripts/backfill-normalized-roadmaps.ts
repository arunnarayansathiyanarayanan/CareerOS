/**
 * One-off backfill: onboarding_completed_at is set but there is no active roadmap
 * with at least one roadmap_items row.
 *
 * Run from the `careeros` directory:
 *   npx tsx scripts/backfill-normalized-roadmaps.ts
 *
 * Requires OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (e.g. from .env.local).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { targetRoleFromOnboardingSelection } from "../src/lib/mapOnboardingTargetRole";
import { generateAndPersistRoadmap } from "../src/services/generateAndPersistRoadmap";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const careerosRoot = path.join(__dirname, "..");

function loadDotEnvLocal(): void {
  const p = path.join(careerosRoot, ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

function resumeSkillsFromParsed(resumeParsed: unknown): string[] | undefined {
  if (resumeParsed === null || resumeParsed === undefined) return undefined;
  if (typeof resumeParsed !== "object" || Array.isArray(resumeParsed)) {
    return undefined;
  }
  const skills = (resumeParsed as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return undefined;
  return skills.filter((s): s is string => typeof s === "string" && s.length > 0);
}

async function needsNormalizedRoadmap(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!roadmap?.id) return true;

  const { count, error } = await supabase
    .from("roadmap_items")
    .select("id", { count: "exact", head: true })
    .eq("roadmap_id", roadmap.id);

  if (error) {
    console.error("[backfill] count items:", error);
    return true;
  }

  return !count;
}

async function main(): Promise<void> {
  loadDotEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: profiles, error } = await supabase
    .from("onboarding_profiles")
    .select(
      "user_id, target_role, current_role, years_of_experience, ai_fluency, resume_parsed, updated_at"
    )
    .not("onboarding_completed_at", "is", null)
    .order("updated_at", { ascending: false });

  if (error || !profiles?.length) {
    console.error("[backfill] query profiles:", error);
    process.exit(error ? 1 : 0);
  }

  const latestByUser = new Map<string, (typeof profiles)[number]>();
  for (const row of profiles) {
    if (typeof row.user_id !== "string") continue;
    if (!latestByUser.has(row.user_id)) latestByUser.set(row.user_id, row);
  }

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const [userId, row] of latestByUser) {
    const need = await needsNormalizedRoadmap(supabase, userId);
    if (!need) {
      skip += 1;
      continue;
    }

    if (
      !row.years_of_experience ||
      typeof row.years_of_experience !== "string" ||
      !row.ai_fluency ||
      typeof row.ai_fluency !== "string"
    ) {
      console.warn(
        `[backfill] skip user ${userId}: missing years_of_experience or ai_fluency`
      );
      fail += 1;
      continue;
    }

    const targetRole = targetRoleFromOnboardingSelection(
      row.target_role as string | undefined
    );
    const currentRole =
      typeof row.current_role === "string" && row.current_role.trim() ?
        row.current_role.trim()
      : "Not specified";
    const skills = resumeSkillsFromParsed(row.resume_parsed);

    try {
      const result = await generateAndPersistRoadmap({
        userId,
        targetRole,
        currentRole,
        yearsExperience: row.years_of_experience,
        aiFluency: row.ai_fluency,
        ...(skills?.length ? { existingSkills: skills } : {}),
      });
      console.log(
        `[backfill] user=${userId} roadmapId=${result.roadmapId} items=${result.totalItems}`
      );
      ok += 1;
    } catch (e) {
      console.error(`[backfill] user=${userId}`, e);
      fail += 1;
    }
  }

  console.log(
    `[backfill] done: created=${ok} skipped_already_had_roadmap=${skip} failed=${fail}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
