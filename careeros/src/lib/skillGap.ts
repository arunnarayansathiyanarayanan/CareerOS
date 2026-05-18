import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  skillDemandSnapshots,
  skillGapScores,
  skillOntology,
  userSkillGraph,
  type RankedSkill,
} from "@/db/schema/skillIntelligence";

const TOP_MARKET_SKILLS = 20;
const TOP_RANKED_GAPS = 10;
const PROFICIENCY_MATCH_THRESHOLD = 3;
const PRIORITY_RANK_WEIGHT = 0.6;
const PRIORITY_SALARY_WEIGHT = 0.4;
const MAX_SALARY_LIFT_PCT = 80;

export type SkillGapResult = {
  gapScore: number;
  rankedSkills: {
    skillId: string;
    name: string;
    priority: number;
    expectedSalaryLiftPct: number;
  }[];
  computedAt: Date;
};

type MarketSkillRow = {
  skill_id: string;
  name: string;
  posting_count: number;
  salary_p50: string | null;
  salary_p75: string | null;
};

type UserSkillRow = {
  skillId: string;
  proficiency: number;
  name: string;
};

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function normalizeScores(raw: number[]): number[] {
  if (raw.length === 0) return [];
  if (raw.length === 1) return [100];

  const min = Math.min(...raw);
  const max = Math.max(...raw);
  if (min === max) return raw.map(() => 100);

  return raw.map((v) => Math.round(((v - min) / (max - min)) * 100));
}

async function fetchUserSkills(userId: string): Promise<UserSkillRow[]> {
  const db = getDb();
  return db
    .select({
      skillId: userSkillGraph.skillId,
      proficiency: userSkillGraph.proficiency,
      name: skillOntology.name,
    })
    .from(userSkillGraph)
    .innerJoin(skillOntology, eq(userSkillGraph.skillId, skillOntology.id))
    .where(eq(userSkillGraph.userId, userId));
}

async function fetchTopMarketSkills(
  role: string,
  city: string,
): Promise<MarketSkillRow[]> {
  const db = getDb();
  const result = await db.execute<MarketSkillRow>(sql`
    WITH latest AS (
      SELECT max(computed_at) AS computed_at
      FROM skill_demand_snapshots
      WHERE role = ${role}
        AND city = ${city}
        AND computed_at >= now() - interval '7 days'
    ),
    aggregated AS (
      SELECT
        s.skill_id,
        so.name,
        sum(s.posting_count)::int AS posting_count,
        (percentile_cont(0.50) WITHIN GROUP (ORDER BY s.salary_p50::numeric))::text AS salary_p50,
        (percentile_cont(0.75) WITHIN GROUP (ORDER BY s.salary_p75::numeric))::text AS salary_p75
      FROM skill_demand_snapshots s
      INNER JOIN skill_ontology so ON so.id = s.skill_id
      INNER JOIN latest l ON s.computed_at = l.computed_at
      WHERE s.role = ${role}
        AND s.city = ${city}
      GROUP BY s.skill_id, so.name
    )
    SELECT skill_id, name, posting_count, salary_p50, salary_p75
    FROM aggregated
    ORDER BY posting_count DESC
    LIMIT ${TOP_MARKET_SKILLS}
  `);
  return result.rows;
}

async function fetchUserMedianSalary(
  role: string,
  city: string,
  skillIds: string[],
): Promise<number | null> {
  if (skillIds.length === 0) return null;

  const db = getDb();
  const rows = await db
    .select({ salaryP50: skillDemandSnapshots.salaryP50 })
    .from(skillDemandSnapshots)
    .where(
      and(
        eq(skillDemandSnapshots.role, role),
        eq(skillDemandSnapshots.city, city),
        inArray(skillDemandSnapshots.skillId, skillIds),
        sql`${skillDemandSnapshots.computedAt} >= now() - interval '7 days'`,
      ),
    );

  const salaries = rows
    .map((r) => toNumber(r.salaryP50))
    .filter((n): n is number => n != null && n > 0);

  return median(salaries);
}

async function upsertSkillGapScore(
  userId: string,
  role: string,
  city: string,
  gapScore: number,
  rankedSkills: RankedSkill[],
  computedAt: Date,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ id: skillGapScores.id })
    .from(skillGapScores)
    .where(
      and(
        eq(skillGapScores.userId, userId),
        eq(skillGapScores.role, role),
        eq(skillGapScores.city, city),
      ),
    )
    .limit(1);

  const payload = {
    gapScore,
    rankedSkills,
    computedAt,
  };

  if (existing[0]) {
    await db
      .update(skillGapScores)
      .set(payload)
      .where(eq(skillGapScores.id, existing[0].id));
    return;
  }

  await db.insert(skillGapScores).values({
    userId,
    role,
    city,
    ...payload,
  });
}

/**
 * Compares the user's skill graph to market demand for a role/city and persists
 * a gap score plus ranked upskill recommendations.
 */
export async function computeSkillGap(
  userId: string,
  role: string,
  city: string,
): Promise<SkillGapResult> {
  const computedAt = new Date();
  const userSkills = await fetchUserSkills(userId);
  const userBySkillId = new Map(
    userSkills.map((s) => [s.skillId, s] as const),
  );

  const marketSkills = await fetchTopMarketSkills(role, city);

  const baselineP50Values = marketSkills
    .map((s) => toNumber(s.salary_p50))
    .filter((n): n is number => n != null && n > 0);
  const baselineP50 = median(baselineP50Values) ?? 0;

  const userMedianSalary =
    (await fetchUserMedianSalary(
      role,
      city,
      userSkills.map((s) => s.skillId),
    )) ?? baselineP50;

  const matchedSkills = marketSkills.filter((market) => {
    const owned = userBySkillId.get(market.skill_id);
    return owned != null && owned.proficiency >= PROFICIENCY_MATCH_THRESHOLD;
  }).length;

  const gapScore = Math.round(
    100 - (matchedSkills / TOP_MARKET_SKILLS) * 100,
  );

  const gapCandidates = marketSkills
    .map((market, index) => {
      const owned = userBySkillId.get(market.skill_id);
      const isGap =
        owned == null || owned.proficiency < PROFICIENCY_MATCH_THRESHOLD;
      if (!isGap) return null;

      const postingCountRank = index + 1;
      const salaryP75 = toNumber(market.salary_p75) ?? 0;
      const rankComponent = TOP_MARKET_SKILLS + 1 - postingCountRank;
      const salaryComponent = salaryP75 - userMedianSalary;
      const rawPriority =
        rankComponent * PRIORITY_RANK_WEIGHT +
        salaryComponent * PRIORITY_SALARY_WEIGHT;

      const salaryP75ForLift = toNumber(market.salary_p75);
      const expectedSalaryLiftPct =
        baselineP50 > 0 && salaryP75ForLift != null
          ? clamp(
              ((salaryP75ForLift - baselineP50) / baselineP50) * 100,
              0,
              MAX_SALARY_LIFT_PCT,
            )
          : 0;

      return {
        skillId: market.skill_id,
        name: market.name,
        rawPriority,
        expectedSalaryLiftPct: Math.round(expectedSalaryLiftPct),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const normalizedPriorities = normalizeScores(
    gapCandidates.map((c) => c.rawPriority),
  );

  const rankedSkills = gapCandidates
    .map((candidate, i) => ({
      skillId: candidate.skillId,
      name: candidate.name,
      priority: normalizedPriorities[i] ?? 0,
      expectedSalaryLiftPct: candidate.expectedSalaryLiftPct,
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, TOP_RANKED_GAPS);

  const rankedForDb: RankedSkill[] = rankedSkills.map((s) => ({
    skill_id: s.skillId,
    priority: s.priority,
    expected_salary_lift_pct: s.expectedSalaryLiftPct,
  }));

  await upsertSkillGapScore(
    userId,
    role,
    city,
    gapScore,
    rankedForDb,
    computedAt,
  );

  return {
    gapScore,
    rankedSkills,
    computedAt,
  };
}
