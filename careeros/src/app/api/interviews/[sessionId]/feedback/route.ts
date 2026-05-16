import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { getInterviewFeedbackResponse } from "@/lib/interviews/feedback";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ sessionId: string }> };

const uuidSchema = z.string().uuid();

export async function POST(req: Request, context: RouteContext) {
  try {
    const { userId, supabase } = await requireAuth(req);
    const { sessionId } = await context.params;

    if (!uuidSchema.safeParse(sessionId).success) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    const result = await getInterviewFeedbackResponse(
      supabase,
      sessionId,
      userId
    );

    if ("error" in result && result.error === "not_found") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[interviews/feedback]", error);
    return NextResponse.json(
      { error: "Failed to load feedback" },
      { status: 502 }
    );
  }
}

export async function GET(req: Request, context: RouteContext) {
  return POST(req, context);
}
