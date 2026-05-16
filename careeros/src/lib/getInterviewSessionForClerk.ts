import { createClient } from "@supabase/supabase-js";

import type { InterviewSessionRow } from "@/lib/interviews/types";
import { normalizeTranscript } from "@/lib/interviews/transcript";

function mapSessionRow(row: Record<string, unknown>): InterviewSessionRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    track: row.track as InterviewSessionRow["track"],
    sub_mode: String(row.sub_mode),
    status: row.status as InterviewSessionRow["status"],
    mode: row.mode as InterviewSessionRow["mode"],
    duration_seconds:
      row.duration_seconds != null ? Number(row.duration_seconds) : null,
    project_context_ids: Array.isArray(row.project_context_ids)
      ? (row.project_context_ids as string[])
      : null,
    audio_url: row.audio_url != null ? String(row.audio_url) : null,
    transcript: normalizeTranscript(row.transcript),
    started_at: String(row.started_at),
    completed_at:
      row.completed_at != null ? String(row.completed_at) : null,
    created_at: String(row.created_at),
  };
}

/**
 * Loads an interview session owned by the Clerk user, or null if missing / unauthorized.
 */
export async function getInterviewSessionForClerk(
  clerkId: string,
  sessionId: string
): Promise<InterviewSessionRow | null> {
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

  const { data: session, error: sessionErr } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userRow.id)
    .maybeSingle();

  if (sessionErr || !session) {
    return null;
  }

  return mapSessionRow(session as Record<string, unknown>);
}
