import { createClient } from "@supabase/supabase-js";

import {
  FREE_TIER_WEEKLY_SESSION_LIMIT,
  getOrCreateWeeklyQuota,
  getWeeklySessionsUsed,
  isPaidInterviewTier,
  type WeeklyQuotaRow,
} from "@/lib/interviews/quota";
import type { ReadinessScore } from "@/lib/interviews/types";

export type InterviewSetupProject = {
  id: string;
  name: string;
  stack: string[];
  description: string;
};

export type InterviewSetupData = {
  isPro: boolean;
  quota: WeeklyQuotaRow;
  projects: InterviewSetupProject[];
  readinessScores: ReadinessScore[];
};

function mapReadinessRow(row: Record<string, unknown>): ReadinessScore {
  return {
    track: row.track as ReadinessScore["track"],
    score: Number(row.score),
    session_count: Number(row.session_count),
    avg_overall_score: Number(row.avg_overall_score),
    computed_at: String(row.computed_at),
  };
}

/**
 * Loads interview lobby data for the signed-in Clerk user.
 */
export async function getInterviewSetupForClerk(
  clerkId: string
): Promise<InterviewSetupData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }

  const supabase = createClient(url, key);

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (userErr || !userRow || typeof userRow.id !== "string") {
    return null;
  }

  const userId = userRow.id;

  const [isPro, quota, weeklySessionsUsed, projectsResult, readinessResult] =
    await Promise.all([
    isPaidInterviewTier(supabase, userId),
    getOrCreateWeeklyQuota(supabase, userId),
    getWeeklySessionsUsed(supabase, userId),
    supabase
      .from("projects")
      .select("id, title, one_liner, ai_stack")
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .not("published_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("interview_readiness_scores")
      .select("track, score, session_count, avg_overall_score, computed_at")
      .eq("user_id", userId)
      .order("track", { ascending: true }),
    ]);

  if (projectsResult.error) {
    console.error(
      "[getInterviewSetupForClerk] projects:",
      projectsResult.error.message
    );
    return null;
  }

  if (readinessResult.error) {
    console.error(
      "[getInterviewSetupForClerk] readiness:",
      readinessResult.error.message
    );
    return null;
  }

  const projects: InterviewSetupProject[] = (projectsResult.data ?? []).map(
    (row) => {
      const r = row as {
        id: string;
        title: string;
        one_liner: string;
        ai_stack: string[] | null;
      };
      return {
        id: r.id,
        name: r.title,
        stack: Array.isArray(r.ai_stack) ? r.ai_stack : [],
        description: r.one_liner,
      };
    }
  );

  const readinessScores = (readinessResult.data ?? []).map((row) =>
    mapReadinessRow(row as Record<string, unknown>)
  );

  return {
    isPro,
    quota: {
      ...quota,
      sessions_used: Math.min(weeklySessionsUsed, FREE_TIER_WEEKLY_SESSION_LIMIT),
    },
    projects,
    readinessScores,
  };
}
