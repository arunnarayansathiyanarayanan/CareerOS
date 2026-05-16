import { after, NextResponse } from "next/server";
import { z } from "zod";

import { InterviewAIError, STTError } from "@/lib/ai/errors";
import { generateInterviewerTurn } from "@/lib/ai/interview-ai";
import { transcribeAudio } from "@/lib/ai/stt";
import { TURNS_BY_SUB_MODE, type SubMode } from "@/lib/ai/question-bank";
import { generateAndPersistInterviewFeedback } from "@/lib/interviews/feedback";
import { fetchInterviewProjects } from "@/lib/interviews/projects";
import { uploadInterviewAudio } from "@/lib/storage/interview-audio";
import { withLockedInterviewSession } from "@/lib/interviews/session-db";
import {
  appendTranscriptEntry,
  countCandidateTurns,
  elapsedMsSinceStart,
  expectedUserTurnNumber,
  normalizeTranscript,
  transcriptToInterviewHistory,
} from "@/lib/interviews/transcript";
import type {
  InterviewSessionRow,
  TranscriptEntry,
  TurnInterviewResponse,
} from "@/lib/interviews/types";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ sessionId: string }> };

const uuidSchema = z.string().uuid();

type TurnErrorBody = Record<string, unknown>;

function turnError(status: number, body: TurnErrorBody): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request, context: RouteContext) {
  let userId: string;
  let supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"];

  try {
    ({ userId, supabase } = await requireAuth(req));
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }

  const { sessionId } = await context.params;

  if (!uuidSchema.safeParse(sessionId).success) {
    return turnError(400, { error: "Invalid session id" });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return turnError(400, { error: "Expected multipart form data" });
  }

  const modeParsed = z.enum(["voice", "text"]).safeParse(form.get("mode"));
  if (!modeParsed.success) {
    return turnError(422, { error: "Invalid mode" });
  }
  const mode = modeParsed.data;

  const turnNumber = Number(form.get("turnNumber"));
  if (!Number.isInteger(turnNumber) || turnNumber < 1) {
    return turnError(422, { error: "Invalid turnNumber" });
  }

  const textInputRaw = form.get("textInput");
  const audioBlob = form.get("audioBlob");

  try {
    const phase1 = await withLockedInterviewSession(
      sessionId,
      userId,
      async ({ session, updateSession }) => {
        if (session.status !== "in_progress") {
          return { kind: "error" as const, status: 409, body: { error: "Session is not in progress" } };
        }

        const subMode = session.sub_mode as SubMode;
        const totalTurns = TURNS_BY_SUB_MODE[subMode];
        const transcript = normalizeTranscript(session.transcript);
        const expectedTurn = expectedUserTurnNumber(transcript);

        if (turnNumber !== expectedTurn) {
          return {
            kind: "error" as const,
            status: 409,
            body: { error: "Turn number mismatch", expectedTurn },
          };
        }

        if (turnNumber > totalTurns) {
          return {
            kind: "error" as const,
            status: 409,
            body: { error: "Interview already complete" },
          };
        }

        let candidateText: string;
        let transcribedText: string | undefined;

        if (mode === "voice") {
          if (!(audioBlob instanceof File) || audioBlob.size === 0) {
            return {
              kind: "error" as const,
              status: 422,
              body: { error: "audioBlob is required for voice mode" },
            };
          }
          try {
            const buffer = Buffer.from(await audioBlob.arrayBuffer());
            const stt = await transcribeAudio(
              buffer,
              audioBlob.type || "audio/webm"
            );
            candidateText = stt.text;
            transcribedText = stt.text;
          } catch (error) {
            if (error instanceof STTError) {
              return {
                kind: "error" as const,
                status: 422,
                body: { error: "stt_failed", fallback: "text" },
              };
            }
            throw error;
          }
        } else {
          const textParsed = z.string().min(1).safeParse(textInputRaw);
          if (!textParsed.success) {
            return {
              kind: "error" as const,
              status: 422,
              body: { error: "textInput is required for text mode" },
            };
          }
          candidateText = textParsed.data.trim();
        }

        const updatedTranscript = appendTranscriptEntry(transcript, {
          role: "candidate",
          content: candidateText,
          timestamp_ms: elapsedMsSinceStart(session.started_at),
          turn_number: turnNumber,
        });

        await updateSession({ mode, transcript: updatedTranscript });

        return {
          kind: "ok" as const,
          session,
          subMode,
          totalTurns,
          updatedTranscript,
          transcribedText,
        };
      }
    );

    if (phase1 === null) {
      return turnError(404, { error: "Session not found" });
    }

    if (phase1.kind === "error") {
      return turnError(phase1.status, phase1.body);
    }

    const {
      session,
      totalTurns,
      updatedTranscript: transcriptAfterCandidate,
      transcribedText,
    } = phase1;

    const userProjects = await fetchInterviewProjects(
      supabase,
      userId,
      session.project_context_ids
    );

    const aiTurnNumber = countCandidateTurns(transcriptAfterCandidate) + 1;
    const history = transcriptToInterviewHistory(transcriptAfterCandidate);

    let interviewerTurn;
    try {
      interviewerTurn = await generateInterviewerTurn({
        track: session.track,
        subMode: session.sub_mode,
        userProjects,
        history,
        turnNumber: aiTurnNumber,
        totalTurns,
      });
    } catch (error) {
      if (error instanceof InterviewAIError) {
        return turnError(502, {
          error: "interview_generation_failed",
          code: error.code,
        });
      }
      throw error;
    }

    const isComplete = turnNumber === totalTurns;
    const completedAt = isComplete ? new Date().toISOString() : null;
    const durationSeconds = Math.round(
      elapsedMsSinceStart(session.started_at) / 1000
    );

    const phase2 = await withLockedInterviewSession(
      sessionId,
      userId,
      async ({ session: lockedSession, updateSession }) => {
        const current = normalizeTranscript(lockedSession.transcript);
        const last = current[current.length - 1];
        if (
          last?.role !== "candidate" ||
          last.turn_number !== turnNumber ||
          last.content !==
            transcriptAfterCandidate[transcriptAfterCandidate.length - 1]
              ?.content
        ) {
          return {
            kind: "error" as const,
            status: 409,
            body: { error: "Concurrent turn conflict; retry" },
          };
        }

        const finalTranscript = appendTranscriptEntry(current, {
          role: "interviewer",
          content: interviewerTurn.question,
          timestamp_ms: elapsedMsSinceStart(lockedSession.started_at),
          turn_number: aiTurnNumber,
        });

        await updateSession({
          transcript: finalTranscript,
          status: isComplete ? "completed" : "in_progress",
          completed_at: completedAt,
          duration_seconds: isComplete
            ? durationSeconds
            : lockedSession.duration_seconds,
        });

        return { kind: "ok" as const, finalTranscript };
      }
    );

    if (phase2 === null) {
      return turnError(404, { error: "Session not found" });
    }

    if (phase2.kind === "error") {
      return turnError(phase2.status, phase2.body);
    }

    let audioUrl: string | null = null;
    if (mode === "voice" && interviewerTurn.audioBuffer) {
      audioUrl = await uploadInterviewAudio(
        sessionId,
        aiTurnNumber,
        interviewerTurn.audioBuffer,
        supabase
      );
    }

    if (isComplete) {
      const completedSession: InterviewSessionRow = {
        ...session,
        transcript: phase2.finalTranscript as TranscriptEntry[],
        status: "completed",
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        mode,
      };
      after(() => {
        void generateAndPersistInterviewFeedback(
          supabase,
          completedSession,
          userId
        ).catch((err) => {
          console.error("[interviews/turn] background feedback:", err);
        });
      });
    }

    const response: TurnInterviewResponse = {
      question: interviewerTurn.question,
      audioUrl,
      turnNumber: aiTurnNumber,
      isComplete,
      ...(transcribedText !== undefined ? { transcribedText } : {}),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[interviews/turn]", error);
    return turnError(502, { error: "Failed to process turn" });
  }
}
