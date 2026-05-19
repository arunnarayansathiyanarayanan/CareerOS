import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, lt, max, sql } from "drizzle-orm";
import { z } from "zod";

import type { DrizzleDB } from "@/db/types";
import { profiles } from "@/db/schema/profile";
import { roadmapItems, roadmaps } from "@/db/schema/roadmap";
import {
  jobPostingSeniorityEnum,
  skillDemandSnapshots,
  skillOntology,
  userSkillGraph,
} from "@/db/schema/skillIntelligence";
import { openai } from "@/lib/ai/openai-client";
import { computeSkillGap, type SkillGapResult } from "@/lib/skillGap";
import { redis } from "@/server/redis";

import { protectedProcedure, publicProcedure, router } from "../trpc";

const SKILL_GAP_CACHE_TTL_SEC = 86_400;
const MAX_DEMAND_WINDOW_DAYS = 180;
const STALE_COMPUTED_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const dashboardPeriodSchema = z.enum(["30d", "90d", "180d"]);

const dashboardInputSchema = z.object({
  city: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  seniority: z.enum(jobPostingSeniorityEnum.enumValues).optional(),
  period: dashboardPeriodSchema,
});

const PROFILE_TO_DEMAND_ROLE: Record<string, string> = {
  AI_PM: "ai_product_manager",
  AI_GENERALIST: "ai_generalist",
  AI_ENGINEER: "ai_engineer",
  AI_MARKETER: "ai_marketer",
  AI_OPERATOR: "ai_operator",
  AI_FOUNDER: "ai_native_founder",
};

const PERIOD_TO_WINDOW_DAYS: Record<z.infer<typeof dashboardPeriodSchema>, number> =
  {
    "30d": 30,
    "90d": 90,
    "180d": 180,
  };

type DashboardSkillRow = {
  skillId: string;
  skillName: string;
  slug: string;
  postingCount: number;
  salaryP25: number | null;
  salaryP50: number | null;
  salaryP75: number | null;
  changePct: number | null;
};

type SerializedSkillGapResult = Omit<SkillGapResult, "computedAt"> & {
  computedAt: string;
};

function periodEndForWindow(runDate: Date, windowDays: number): string {
  const anchor = new Date(runDate);
  anchor.setUTCDate(anchor.getUTCDate() - (MAX_DEMAND_WINDOW_DAYS - windowDays));
  return anchor.toISOString().slice(0, 10);
}

function previousWeeklyRunDate(runDate: Date): Date {
  const anchor = new Date(runDate);
  anchor.setUTCDate(anchor.getUTCDate() - 7);
  return anchor;
}

function demandRoleFromProfileTargetRole(targetRole: string): string {
  return PROFILE_TO_DEMAND_ROLE[targetRole] ?? "ai_generalist";
}

function cityFromProfileLocation(location: string | null | undefined): string {
  if (!location?.trim()) return "bangalore";

  const loc = location.toLowerCase();
  if (/bengaluru|bangalore|\bblr\b/.test(loc)) return "bangalore";
  if (/mumbai|bombay|thane|navi mumbai/.test(loc)) return "mumbai";
  if (/delhi|ncr|gurgaon|gurugram|noida|faridabad|ghaziabad/.test(loc)) {
    return "delhi-ncr";
  }
  if (/hyderabad|secunderabad/.test(loc)) return "hyderabad";
  if (/chennai|madras/.test(loc)) return "chennai";
  if (/pune|pimpri/.test(loc)) return "pune";
  if (/kolkata|calcutta/.test(loc)) return "kolkata";
  if (/ahmedabad/.test(loc)) return "ahmedabad";
  if (/remote/.test(loc)) return "remote";
  return "other";
}

function toSalaryNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function serializeSkillGap(result: SkillGapResult): SerializedSkillGapResult {
  return {
    ...result,
    computedAt: result.computedAt.toISOString(),
  };
}

function deserializeSkillGap(
  cached: SerializedSkillGapResult,
): SkillGapResult {
  return {
    ...cached,
    computedAt: new Date(cached.computedAt),
  };
}

async function getCachedSkillGap(
  userId: string,
  role: string,
  city: string,
): Promise<SkillGapResult> {
  const cacheKey = `skill-gap:${userId}`;
  const cached = await redis.get<string>(cacheKey);

  if (cached) {
    try {
      return deserializeSkillGap(JSON.parse(cached) as SerializedSkillGapResult);
    } catch {
      await redis.del(cacheKey);
    }
  }

  const result = await computeSkillGap(userId, role, city);
  await redis.set(cacheKey, JSON.stringify(serializeSkillGap(result)), {
    ex: SKILL_GAP_CACHE_TTL_SEC,
  });
  return result;
}

function buildSnapshotFilterSql(input: {
  city?: string;
  role?: string;
  seniority?: string;
}): ReturnType<typeof sql> {
  const parts: ReturnType<typeof sql>[] = [];
  if (input.city) parts.push(sql`s.city = ${input.city}`);
  if (input.role) parts.push(sql`s.role = ${input.role}`);
  if (input.seniority) parts.push(sql`s.seniority = ${input.seniority}`);
  if (parts.length === 0) return sql`TRUE`;
  return sql.join(parts, sql` AND `);
}

async function fetchAggregatedSnapshots(
  db: DrizzleDB,
  periodEnd: string,
  computedAt: Date,
  input: z.infer<typeof dashboardInputSchema>,
): Promise<
  {
    skill_id: string;
    skill_name: string;
    slug: string;
    posting_count: number;
    salary_p25: string | null;
    salary_p50: string | null;
    salary_p75: string | null;
  }[]
> {
  const filterSql = buildSnapshotFilterSql(input);
  const result = await db.execute<{
    skill_id: string;
    skill_name: string;
    slug: string;
    posting_count: number;
    salary_p25: string | null;
    salary_p50: string | null;
    salary_p75: string | null;
  }>(sql`
    SELECT
      s.skill_id,
      max(so.name) AS skill_name,
      max(so.slug) AS slug,
      sum(s.posting_count)::int AS posting_count,
      (
        percentile_cont(0.25) WITHIN GROUP (ORDER BY s.salary_p25::numeric)
      )::text AS salary_p25,
      (
        percentile_cont(0.50) WITHIN GROUP (ORDER BY s.salary_p50::numeric)
      )::text AS salary_p50,
      (
        percentile_cont(0.75) WITHIN GROUP (ORDER BY s.salary_p75::numeric)
      )::text AS salary_p75
    FROM skill_demand_snapshots s
    INNER JOIN skill_ontology so ON so.id = s.skill_id
    WHERE s.period_end = ${periodEnd}
      AND s.computed_at = ${computedAt}
      AND ${filterSql}
    GROUP BY s.skill_id
  `);
  return result.rows;
}

function mapTrendRows(
  currentRows: Awaited<ReturnType<typeof fetchAggregatedSnapshots>>,
  previousRows: Awaited<ReturnType<typeof fetchAggregatedSnapshots>>,
): DashboardSkillRow[] {
  const previousBySkill = new Map(
    previousRows.map((row) => [row.skill_id, row.posting_count] as const),
  );

  return currentRows.map((row) => {
    const prev = previousBySkill.get(row.skill_id) ?? 0;
    const changePct =
      prev > 0 ?
        Math.round(((row.posting_count - prev) / prev) * 1000) / 10
      : row.posting_count > 0 ?
        100
      : 0;

    return {
      skillId: row.skill_id,
      skillName: row.skill_name,
      slug: row.slug,
      postingCount: row.posting_count,
      salaryP25: toSalaryNumber(row.salary_p25),
      salaryP50: toSalaryNumber(row.salary_p50),
      salaryP75: toSalaryNumber(row.salary_p75),
      changePct,
    };
  });
}

export const skillIntelligenceRouter = router({
  getPublicDashboard: publicProcedure
    .input(dashboardInputSchema)
    .query(async ({ ctx, input }) => {
      const windowDays = PERIOD_TO_WINDOW_DAYS[input.period];
      const snapshotFilters = [
        ...(input.city ? [eq(skillDemandSnapshots.city, input.city)] : []),
        ...(input.role ? [eq(skillDemandSnapshots.role, input.role)] : []),
        ...(input.seniority ?
          [eq(skillDemandSnapshots.seniority, input.seniority)]
        : []),
      ];

      const [latestRow] = await ctx.db
        .select({ latestComputedAt: max(skillDemandSnapshots.computedAt) })
        .from(skillDemandSnapshots)
        .where(snapshotFilters.length > 0 ? and(...snapshotFilters) : undefined);

      const latestComputedAt = latestRow?.latestComputedAt;
      if (!latestComputedAt) {
        return {
          top20ByVolume: [] as DashboardSkillRow[],
          top20BySalary: [] as DashboardSkillRow[],
          top10Rising: [] as DashboardSkillRow[],
          top10Declining: [] as DashboardSkillRow[],
          isStale: true,
          computedAt: null,
          periodEnd: null,
        };
      }

      const isStale =
        Date.now() - latestComputedAt.getTime() > STALE_COMPUTED_AFTER_MS;

      const currentPeriodEnd = periodEndForWindow(latestComputedAt, windowDays);
      const previousPeriodEnd = periodEndForWindow(
        previousWeeklyRunDate(latestComputedAt),
        windowDays,
      );

      const previousComputedConditions = [
        eq(skillDemandSnapshots.periodEnd, previousPeriodEnd),
        lt(skillDemandSnapshots.computedAt, latestComputedAt),
        ...snapshotFilters,
      ];

      const [previousComputedRow] = await ctx.db
        .select({
          previousComputedAt: max(skillDemandSnapshots.computedAt),
        })
        .from(skillDemandSnapshots)
        .where(and(...previousComputedConditions));

      const previousComputedAt =
        previousComputedRow?.previousComputedAt ??
        previousWeeklyRunDate(latestComputedAt);

      const [currentRows, previousRows] = await Promise.all([
        fetchAggregatedSnapshots(
          ctx.db,
          currentPeriodEnd,
          latestComputedAt,
          input,
        ),
        fetchAggregatedSnapshots(
          ctx.db,
          previousPeriodEnd,
          previousComputedAt,
          input,
        ),
      ]);

      const trendRows = mapTrendRows(currentRows, previousRows);

      const top20ByVolume = [...trendRows]
        .sort((a, b) => b.postingCount - a.postingCount)
        .slice(0, 20)
        .map(({ changePct: _changePct, ...row }) => ({
          ...row,
          changePct: null,
        }));

      const top20BySalary = [...trendRows]
        .filter((row) => row.salaryP50 != null)
        .sort((a, b) => (b.salaryP50 ?? 0) - (a.salaryP50 ?? 0))
        .slice(0, 20)
        .map(({ changePct: _changePct, ...row }) => ({
          ...row,
          changePct: null,
        }));

      const top10Rising = [...trendRows]
        .filter((row) => (row.changePct ?? 0) > 0)
        .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
        .slice(0, 10);

      const top10Declining = [...trendRows]
        .filter((row) => (row.changePct ?? 0) < 0)
        .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))
        .slice(0, 10);

      return {
        top20ByVolume,
        top20BySalary,
        top10Rising,
        top10Declining,
        isStale,
        computedAt: latestComputedAt.toISOString(),
        periodEnd: currentPeriodEnd,
        filters: {
          city: input.city ?? null,
          role: input.role ?? null,
          seniority: input.seniority ?? null,
          period: input.period,
        },
      };
    }),

  getMySkillGap: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.appUser.id;

    const [profile] = await ctx.db
      .select({
        targetRole: profiles.targetRole,
        location: profiles.location,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!profile) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Profile not found.",
      });
    }

    const role = demandRoleFromProfileTargetRole(profile.targetRole);
    const city = cityFromProfileLocation(profile.location);

    return getCachedSkillGap(userId, role, city);
  }),

  addSkillToRoadmap: protectedProcedure
    .input(z.object({ skillId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.appUser.id;

      const [skill] = await ctx.db
        .select({
          id: skillOntology.id,
          name: skillOntology.name,
        })
        .from(skillOntology)
        .where(
          and(eq(skillOntology.id, input.skillId), eq(skillOntology.isActive, true)),
        )
        .limit(1);

      if (!skill) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Skill not found.",
        });
      }

      const [roadmap] = await ctx.db
        .select({ id: roadmaps.id })
        .from(roadmaps)
        .where(and(eq(roadmaps.userId, userId), eq(roadmaps.status, "active")))
        .orderBy(desc(roadmaps.updatedAt))
        .limit(1);

      if (!roadmap) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active roadmap not found.",
        });
      }

      const [existing] = await ctx.db
        .select({ id: roadmapItems.id })
        .from(roadmapItems)
        .where(
          and(
            eq(roadmapItems.roadmapId, roadmap.id),
            sql`${roadmapItems.completionChecklist}->>'skillId' = ${input.skillId}`,
          ),
        )
        .limit(1);

      if (existing) {
        return { success: true as const };
      }

      const [orderRow] = await ctx.db
        .select({
          maxPhaseOrder: sql<number>`coalesce(max(${roadmapItems.phaseOrder}), 0)::int`,
          maxItemOrder: sql<number>`coalesce(max(${roadmapItems.itemOrder}), 0)::int`,
        })
        .from(roadmapItems)
        .where(eq(roadmapItems.roadmapId, roadmap.id));

      const phaseOrder = orderRow?.maxPhaseOrder ?? 1;
      const itemOrder = (orderRow?.maxItemOrder ?? 0) + 1;

      await ctx.db.insert(roadmapItems).values({
        roadmapId: roadmap.id,
        type: "concept",
        phase: "Market-driven upskilling",
        phaseOrder,
        itemOrder,
        title: `Learn ${skill.name}`,
        description: `Build working knowledge of ${skill.name} to close a verified market skill gap for your target role.`,
        estimatedHours: 6,
        difficulty: 2,
        dependencies: [],
        status: "not_started",
        externalLinks: [],
        techStack: [],
        completionChecklist: { skillId: input.skillId },
      });

      return { success: true as const };
    }),

  askAdvisor: protectedProcedure
    .input(z.object({ question: z.string().min(1).max(4000) }))
    .mutation(async function* ({ ctx, input }) {
      const userId = ctx.appUser.id;

      const [profile] = await ctx.db
        .select({
          targetRole: profiles.targetRole,
          location: profiles.location,
        })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      }

      const role = demandRoleFromProfileTargetRole(profile.targetRole);
      const city = cityFromProfileLocation(profile.location);
      const gap = await getCachedSkillGap(userId, role, city);

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "You are an Aihired AI Career Advisor. Answer based on India AI job market data. Be direct, data-grounded, and specific. Cite skill names and numbers.",
          },
          {
            role: "user",
            content: `Skill gap context (JSON):\n${JSON.stringify(serializeSkillGap(gap))}\n\nUser role: ${role}\nUser city: ${city}\n\nQuestion:\n${input.question}`,
          },
        ],
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
    }),

  getMySkillGraph: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: userSkillGraph.id,
        skillId: userSkillGraph.skillId,
        source: userSkillGraph.source,
        proficiency: userSkillGraph.proficiency,
        updatedAt: userSkillGraph.updatedAt,
        skillName: skillOntology.name,
        skillSlug: skillOntology.slug,
        skillCategory: skillOntology.category,
        skillAliases: skillOntology.aliases,
      })
      .from(userSkillGraph)
      .innerJoin(skillOntology, eq(userSkillGraph.skillId, skillOntology.id))
      .where(eq(userSkillGraph.userId, ctx.appUser.id))
      .orderBy(desc(userSkillGraph.proficiency), asc(skillOntology.name));

    return rows;
  }),
});
