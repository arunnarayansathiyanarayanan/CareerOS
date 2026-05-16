import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { loadOwnedSession } from "@/lib/interviews/feedback";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ sessionId: string }> };

const uuidSchema = z.string().uuid();

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { supabase, userId } = await requireAuth(req);
    const { sessionId } = await context.params;

    if (!uuidSchema.safeParse(sessionId).success) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const session = await loadOwnedSession(supabase, sessionId, userId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: feedback, error: feedbackError } = await supabase
      .from("interview_feedback")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (feedbackError) {
      throw new Error(feedbackError.message);
    }
    if (!feedback) {
      return NextResponse.json(
        { error: "Feedback not found for session" },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from("interview_feedback")
      .update({ helpfulness_rating: parsed.data.rating })
      .eq("session_id", sessionId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      sessionId,
      helpfulness_rating: parsed.data.rating,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[interviews/feedback/rate]", error);
    return NextResponse.json(
      { error: "Failed to update rating" },
      { status: 502 }
    );
  }
}
