import { NextResponse } from "next/server";
import { z } from "zod";

import { synthesizeSpeech } from "@/lib/ai/tts";
import {
  getOpeningQuestion,
  TURNS_BY_SUB_MODE,
  validateSubMode,
  type SubMode,
  type Track,
} from "@/lib/ai/question-bank";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { validateProjectContextIds } from "@/lib/interviews/projects";
import {
  getNextMondayResetIso,
  getOrCreateWeeklyQuota,
  incrementWeeklyQuotaUsed,
  isPaidInterviewTier,
} from "@/lib/interviews/quota";
import { uploadInterviewAudio } from "@/lib/storage/interview-audio";
import type { StartInterviewResponse } from "@/lib/interviews/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  track: z.enum(["ai_pm", "ai_generalist"]),
  subMode: z.string().min(1),
  projectContextIds: z.array(z.string().uuid()).optional(),
});

export async function POST(req: Request) {
  try {
    const { userId, supabase } = await requireAuth(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !("subMode" in body) ||
      typeof (body as { subMode?: unknown }).subMode !== "string" ||
      (body as { subMode: string }).subMode.trim().length === 0
    ) {
      return NextResponse.json({ error: "subMode is required" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const track = parsed.data.track as Track;
    const subModeRaw = parsed.data.subMode;
    if (!validateSubMode(track, subModeRaw)) {
      return NextResponse.json(
        { error: "Invalid subMode for track" },
        { status: 422 }
      );
    }
    const subMode = subModeRaw as SubMode;
    const totalTurns = TURNS_BY_SUB_MODE[subMode];

    const paid = await isPaidInterviewTier(supabase, userId);
    if (!paid) {
      const quota = await getOrCreateWeeklyQuota(supabase, userId);
      if (quota.sessions_used >= 1) {
        return NextResponse.json(
          {
            error: "weekly_limit_reached",
            resetAt: getNextMondayResetIso(),
          },
          { status: 429 }
        );
      }
    }

    const projectValidation = await validateProjectContextIds(
      supabase,
      userId,
      parsed.data.projectContextIds
    );
    if (!projectValidation.ok) {
      return NextResponse.json(
        {
          error: "Invalid project context",
          invalidIds: projectValidation.invalid,
        },
        { status: 422 }
      );
    }

    const openingQuestion = getOpeningQuestion(subMode);
    const initialTranscript = [
      {
        role: "interviewer" as const,
        content: openingQuestion,
        timestamp_ms: 0,
        turn_number: 0,
      },
    ];

    const { data: session, error: insertError } = await supabase
      .from("interview_sessions")
      .insert({
        user_id: userId,
        track,
        sub_mode: subMode,
        status: "in_progress",
        project_context_ids:
          projectValidation.ids.length > 0 ? projectValidation.ids : null,
        transcript: initialTranscript,
      })
      .select("id")
      .single();

    if (insertError || !session) {
      console.error("[interviews/start] insert session:", insertError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 502 }
      );
    }

    const sessionId = session.id as string;

    if (!paid) {
      const quota = await getOrCreateWeeklyQuota(supabase, userId);
      await incrementWeeklyQuotaUsed(
        supabase,
        quota.id,
        quota.sessions_used
      );
    }

    const audioBuffer = await synthesizeSpeech(openingQuestion);
    const audioUrl = await uploadInterviewAudio(sessionId, 0, audioBuffer);

    const response: StartInterviewResponse = {
      sessionId,
      openingQuestion,
      audioUrl,
      totalTurns,
    };

    return NextResponse.json(response);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[interviews/start]", error);
    return NextResponse.json(
      { error: "Failed to start interview" },
      { status: 502 }
    );
  }
}
