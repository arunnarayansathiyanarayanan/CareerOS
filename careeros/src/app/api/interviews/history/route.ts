import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { getInterviewHistoryForUser } from "@/lib/interviews/history";

export const runtime = "nodejs";

const querySchema = z.object({
  track: z.enum(["ai_pm", "ai_generalist"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      track: url.searchParams.get("track") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { track, page, limit } = parsed.data;
    const response = await getInterviewHistoryForUser(userId, {
      track,
      page,
      limit,
    });

    if (!response) {
      return NextResponse.json(
        { error: "Failed to load history" },
        { status: 502 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[interviews/history]", error);
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 502 }
    );
  }
}
