import { NextResponse } from "next/server";

import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import type { ReadinessResponse, ReadinessScore } from "@/lib/interviews/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { supabase, userId } = await requireAuth(req);

    const { data, error } = await supabase
      .from("interview_readiness_scores")
      .select("track, score, session_count, avg_overall_score, computed_at")
      .eq("user_id", userId)
      .order("track", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const scores: ReadinessScore[] = (data ?? []).map((row) => {
      const r = row as {
        track: ReadinessScore["track"];
        score: number;
        session_count: number;
        avg_overall_score: number;
        computed_at: string;
      };
      return {
        track: r.track,
        score: Number(r.score),
        session_count: Number(r.session_count),
        avg_overall_score: Number(r.avg_overall_score),
        computed_at: r.computed_at,
      };
    });

    const response: ReadinessResponse = { scores };
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[interviews/readiness]", error);
    return NextResponse.json(
      { error: "Failed to load readiness scores" },
      { status: 502 }
    );
  }
}
