import { sql } from "drizzle-orm";

import type { getDb } from "@/db";
import type { Track } from "@/lib/ai/question-bank";

export const MIN_COMPLETED_INTERVIEWS_FOR_PUBLIC_READINESS = 3;

export type PublicInterviewReadinessScore = {
  track: Track;
  score: number;
  session_count: number;
  avg_overall_score: number;
};

type Db = ReturnType<typeof getDb>;

export async function loadPublicInterviewReadiness(
  db: Db,
  userId: string,
  interviewReadinessPublic: boolean
): Promise<PublicInterviewReadinessScore[] | null> {
  if (!interviewReadinessPublic) {
    return null;
  }

  const countResult = await db.execute<{ cnt: number }>(sql`
    SELECT count(*)::int AS cnt
    FROM interview_sessions
    WHERE user_id = ${userId}::uuid
      AND status = 'completed'::interview_session_status
  `);

  const completedCount = Number(countResult.rows[0]?.cnt ?? 0);
  if (completedCount < MIN_COMPLETED_INTERVIEWS_FOR_PUBLIC_READINESS) {
    return null;
  }

  const scoresResult = await db.execute<{
    track: Track;
    score: string;
    session_count: number;
    avg_overall_score: string;
  }>(sql`
    SELECT track, score, session_count, avg_overall_score
    FROM interview_readiness_scores
    WHERE user_id = ${userId}::uuid
    ORDER BY track
  `);

  return scoresResult.rows.map((row) => ({
    track: row.track,
    score: Number(row.score),
    session_count: Number(row.session_count),
    avg_overall_score: Number(row.avg_overall_score),
  }));
}
