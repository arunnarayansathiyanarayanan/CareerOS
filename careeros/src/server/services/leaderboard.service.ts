import { createId } from "@paralleldrive/cuid2";
import { and, asc, avg, count, desc, eq, sql } from "drizzle-orm";

import { projects } from "@/db/schema/projects";
import { db } from "@/server/db";
import {
  challengeVotes,
  cohortMembers,
  communityPosts,
  leaderboardEntries,
  peerReviews,
} from "@/server/db/schema/community.schema";
import { interviewReports } from "@/server/db/schema/interview.schema";
import { redis } from "@/server/redis";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function computeInterviewGrowth(
  rows: { overallScore: string | null }[],
): number {
  if (rows.length < 2) return 0;
  const first = toNumber(rows[0]!.overallScore);
  const last = toNumber(rows[rows.length - 1]!.overallScore);
  return clamp(last - first, 0, 10);
}

export async function computeUserScore(
  userId: string,
  cohortId: string,
): Promise<typeof leaderboardEntries.$inferSelect> {
  const [
    [projectStats],
    interviewRows,
    [postStats],
    [reviewStats],
    [voteStats],
  ] = await Promise.all([
    db
      .select({
        count: count(),
        avgScore: avg(projects.aiReviewerScore),
      })
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          eq(projects.privacyMode, "public"),
          eq(projects.isDeleted, false),
        ),
      ),
    db
      .select({ overallScore: interviewReports.overallScore })
      .from(interviewReports)
      .where(eq(interviewReports.userId, userId))
      .orderBy(asc(interviewReports.createdAt)),
    db
      .select({ count: count() })
      .from(communityPosts)
      .where(
        and(
          eq(communityPosts.userId, userId),
          sql`${communityPosts.createdAt} > now() - interval '30 days'`,
        ),
      ),
    db
      .select({ count: count() })
      .from(peerReviews)
      .where(
        and(
          eq(peerReviews.reviewerId, userId),
          eq(peerReviews.status, "COMPLETED"),
          sql`${peerReviews.completedAt} > now() - interval '30 days'`,
        ),
      ),
    db
      .select({ count: count() })
      .from(challengeVotes)
      .where(
        and(
          eq(challengeVotes.voterId, userId),
          sql`${challengeVotes.createdAt} > now() - interval '30 days'`,
        ),
      ),
  ]);

  const projectsShipped = Number(projectStats?.count ?? 0);
  const avgProjectQuality = projectStats?.avgScore
    ? toNumber(projectStats.avgScore)
    : null;
  const interviewScoreGrowth = computeInterviewGrowth(interviewRows);
  const postCount = Number(postStats?.count ?? 0);
  const reviewsCompleted = Number(reviewStats?.count ?? 0);
  const votesGiven = Number(voteStats?.count ?? 0);

  const communityContribution =
    postCount * 1 + reviewsCompleted * 3 + votesGiven * 0.5;

  const score =
    projectsShipped * (avgProjectQuality ?? 0) * 0.5 +
    interviewScoreGrowth * 0.3 +
    communityContribution * 0.2;

  const [entry] = await db
    .insert(leaderboardEntries)
    .values({
      id: createId(),
      userId,
      cohortId,
      score,
      projectsShipped,
      projectQualitySum: avgProjectQuality ?? 0,
      interviewScoreGrowth,
      communityContribution,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [leaderboardEntries.userId, leaderboardEntries.cohortId],
      set: {
        score,
        projectsShipped,
        projectQualitySum: avgProjectQuality ?? 0,
        interviewScoreGrowth,
        communityContribution,
        computedAt: new Date(),
      },
    })
    .returning();

  if (!entry) {
    throw new Error("Failed to upsert leaderboard entry");
  }

  await redis.set(
    `leaderboard:score:${userId}:${cohortId}`,
    JSON.stringify(entry),
    { ex: 3600 },
  );

  return entry;
}

export async function getCohortLeaderboardAll(
  cohortId: string,
): Promise<(typeof leaderboardEntries.$inferSelect)[]> {
  const cached = await redis.get<string>(`leaderboard:cohort:${cohortId}`);
  if (cached) {
    return JSON.parse(cached) as (typeof leaderboardEntries.$inferSelect)[];
  }

  const rows = await db
    .select()
    .from(leaderboardEntries)
    .where(eq(leaderboardEntries.cohortId, cohortId))
    .orderBy(desc(leaderboardEntries.score))
    .limit(500);

  await redis.set(`leaderboard:cohort:${cohortId}`, JSON.stringify(rows), {
    ex: 300,
  });

  return rows;
}

export async function getCohortLeaderboard(
  cohortId: string,
  limit = 50,
  offset = 0,
): Promise<(typeof leaderboardEntries.$inferSelect)[]> {
  const rows = await getCohortLeaderboardAll(cohortId);
  return rows.slice(offset, offset + limit);
}

export async function refreshLeaderboard(cohortId: string): Promise<void> {
  const members = await db
    .select({ userId: cohortMembers.userId })
    .from(cohortMembers)
    .where(
      and(
        eq(cohortMembers.cohortId, cohortId),
        eq(cohortMembers.isActive, true),
      ),
    );

  for (const { userId } of members) {
    await computeUserScore(userId, cohortId);
    await new Promise((r) => setTimeout(r, 50));
  }

  await redis.del(`leaderboard:cohort:${cohortId}`);
}

export async function getGlobalLeaderboardAll(): Promise<
  (typeof leaderboardEntries.$inferSelect)[]
> {
  const cached = await redis.get<string>("leaderboard:global");
  if (cached) {
    return JSON.parse(cached) as (typeof leaderboardEntries.$inferSelect)[];
  }

  const rows = await db
    .select()
    .from(leaderboardEntries)
    .orderBy(desc(leaderboardEntries.score))
    .limit(500);

  await redis.set("leaderboard:global", JSON.stringify(rows), { ex: 600 });

  return rows;
}

export async function getGlobalLeaderboard(
  limit = 50,
  offset = 0,
): Promise<(typeof leaderboardEntries.$inferSelect)[]> {
  const rows = await getGlobalLeaderboardAll();
  return rows.slice(offset, offset + limit);
}
