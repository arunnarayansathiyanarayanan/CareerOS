import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import {
  recordStreakAction,
  type StreakAction,
} from "@/lib/streak/record-action";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum([
    "concept_completed",
    "project_published",
    "interview_completed",
    "feed_post",
  ]),
  userId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId: sessionUserId, supabase } = await requireAuth(req);

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

    const targetUserId = parsed.data.userId ?? sessionUserId;
    if (targetUserId !== sessionUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await recordStreakAction(
      targetUserId,
      parsed.data.action as StreakAction,
      supabase
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[streak/record]", error);
    return NextResponse.json(
      { error: "Failed to record streak" },
      { status: 502 }
    );
  }
}
