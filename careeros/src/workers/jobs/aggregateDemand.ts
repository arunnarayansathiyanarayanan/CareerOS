/**
 * Weekly demand aggregation from scraped job postings.
 *
 * Data freshness: consumers should treat a snapshot as stale when
 * `computed_at < now() - interval '7 days'`. This worker runs weekly via cron
 * so fresh rows stay within that window; stale rows need a re-run or alert.
 *
 * Lookback windows (30 / 90 / 180 days) share the same calendar run date but
 * use distinct `period_end` anchors so upserts do not collide:
 *   period_end = run_date - (180 - window_days)
 * Derive window length: window_days = 180 - (run_date - period_end).
 */
import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  skillDemandSnapshots,
  type JobPostingSeniority,
} from "@/db/schema/skillIntelligence";

const DEMAND_WINDOWS_DAYS = [30, 90, 180] as const;
const MAX_WINDOW_DAYS = 180;
const LOW_SAMPLE_THRESHOLD = 50;

/** SQL fragment: map job title text to onboarding target_role slug. */
const JOB_TITLE_ROLE_SQL = sql.raw(`CASE
  WHEN j.title ~* '(product manager|\\bpm\\b|product owner)' THEN 'ai_product_manager'
  WHEN j.title ~* '(engineer|developer|\\bswe\\b|ml engineer|machine learning engineer|data scientist)' THEN 'ai_engineer'
  WHEN j.title ~* '(marketing|growth|content|brand)' THEN 'ai_marketer'
  WHEN j.title ~* '(operations|operator|chief of staff|program manager)' THEN 'ai_operator'
  WHEN j.title ~* '(founder|co-?founder|ceo|entrepreneur)' THEN 'ai_native_founder'
  ELSE 'ai_generalist'
END`);

type AggregateRow = {
  skill_id: string;
  skill_name: string;
  city: string;
  role: string;
  seniority: string;
  posting_count: number;
  salary_p25: string | null;
  salary_p50: string | null;
  salary_p75: string | null;
  salary_p90: string | null;
  sample_size: number;
};

type ActiveSkillRow = {
  id: string;
  name: string;
};

function periodEndForWindow(runDate: Date, windowDays: number): string {
  const anchor = new Date(runDate);
  anchor.setUTCDate(anchor.getUTCDate() - (MAX_WINDOW_DAYS - windowDays));
  return anchor.toISOString().slice(0, 10);
}

function demandAggregateSql(windowDays: number) {
  const interval = sql.raw(`interval '${windowDays} days'`);
  return sql`
    WITH mapped AS (
      SELECT
        so.id AS skill_id,
        so.name AS skill_name,
        j.city,
        ${JOB_TITLE_ROLE_SQL} AS role,
        j.seniority,
        j.salary_max_lpa::numeric AS salary_max_lpa
      FROM job_postings_raw j
      CROSS JOIN LATERAL unnest(j.raw_skills) AS skill_slug
      INNER JOIN skill_ontology so
        ON so.slug = skill_slug
        AND so.is_active = true
      WHERE j.posted_at >= now() - ${interval}
    )
    SELECT
      skill_id,
      max(skill_name) AS skill_name,
      city,
      role,
      seniority,
      count(*)::int AS posting_count,
      (percentile_cont(0.25) WITHIN GROUP (ORDER BY salary_max_lpa))::text AS salary_p25,
      (percentile_cont(0.50) WITHIN GROUP (ORDER BY salary_max_lpa))::text AS salary_p50,
      (percentile_cont(0.75) WITHIN GROUP (ORDER BY salary_max_lpa))::text AS salary_p75,
      (percentile_cont(0.90) WITHIN GROUP (ORDER BY salary_max_lpa))::text AS salary_p90,
      count(salary_max_lpa)::int AS sample_size
    FROM mapped
    GROUP BY skill_id, city, role, seniority
  `;
}

/**
 * Aggregate job posting demand into `skill_demand_snapshots` for 30/90/180-day
 * windows. Intended to be invoked weekly from cron.
 */
export async function aggregateDemandSnapshots(): Promise<void> {
  const runDate = new Date();
  const computedAt = new Date();
  const db = getDb();

  let totalWritten = 0;
  const lowSampleSkills = new Map<string, { name: string; sampleSize: number }>();
  const skillsWithDemand = new Set<string>();

  for (const windowDays of DEMAND_WINDOWS_DAYS) {
    const periodEnd = periodEndForWindow(runDate, windowDays);
    const result = await db.execute<AggregateRow>(
      demandAggregateSql(windowDays),
    );

    for (const row of result.rows) {
      skillsWithDemand.add(row.skill_id);

      if (row.sample_size < LOW_SAMPLE_THRESHOLD) {
        const existing = lowSampleSkills.get(row.skill_id);
        if (!existing || row.sample_size < existing.sampleSize) {
          lowSampleSkills.set(row.skill_id, {
            name: row.skill_name,
            sampleSize: row.sample_size,
          });
        }
      }

      await db
        .insert(skillDemandSnapshots)
        .values({
          skillId: row.skill_id,
          city: row.city,
          role: row.role,
          seniority: row.seniority as JobPostingSeniority,
          periodEnd,
          postingCount: row.posting_count,
          salaryP25: row.salary_p25,
          salaryP50: row.salary_p50,
          salaryP75: row.salary_p75,
          salaryP90: row.salary_p90,
          sampleSize: row.sample_size,
          computedAt,
        })
        .onConflictDoUpdate({
          target: [
            skillDemandSnapshots.skillId,
            skillDemandSnapshots.city,
            skillDemandSnapshots.role,
            skillDemandSnapshots.seniority,
            skillDemandSnapshots.periodEnd,
          ],
          set: {
            postingCount: row.posting_count,
            salaryP25: row.salary_p25,
            salaryP50: row.salary_p50,
            salaryP75: row.salary_p75,
            salaryP90: row.salary_p90,
            sampleSize: row.sample_size,
            computedAt,
          },
        });
    }

    totalWritten += result.rows.length;
  }

  const activeResult = await db.execute<ActiveSkillRow>(sql`
    SELECT id, name
    FROM skill_ontology
    WHERE is_active = true
    ORDER BY name
  `);
  const zeroDemandSkills = activeResult.rows.filter(
    (s) => !skillsWithDemand.has(s.id),
  );

  console.info(
    `[aggregateDemand] snapshots_written=${totalWritten} windows=${DEMAND_WINDOWS_DAYS.join(",")}`,
  );

  if (lowSampleSkills.size > 0) {
    const flagged = [...lowSampleSkills.values()]
      .sort((a, b) => a.sampleSize - b.sampleSize)
      .map((s) => `${s.name}(n=${s.sampleSize})`);
    console.warn(
      `[aggregateDemand] low_sample_skills (sample_size < ${LOW_SAMPLE_THRESHOLD}): ${flagged.join(", ")}`,
    );
  }

  if (zeroDemandSkills.length > 0) {
    console.warn(
      `[aggregateDemand] zero_demand_skills (possible ontology drift): ${zeroDemandSkills.map((s) => s.name).join(", ")}`,
    );
  }
}
