import { sql } from "drizzle-orm";

import { getDb } from "@/db";
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

export type SessionUpdatePatch = {
  transcript?: unknown;
  status?: InterviewSessionRow["status"];
  mode?: InterviewSessionRow["mode"];
  completed_at?: string | null;
  duration_seconds?: number | null;
};

export type LockedSessionContext = {
  session: InterviewSessionRow;
  updateSession: (patch: SessionUpdatePatch) => Promise<void>;
};

async function applySessionPatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  sessionId: string,
  userId: string,
  patch: SessionUpdatePatch
): Promise<void> {
  if (patch.transcript !== undefined) {
    await tx.execute(sql`
      UPDATE interview_sessions
      SET transcript = ${JSON.stringify(patch.transcript)}::jsonb
      WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
    `);
  }
  if (patch.status !== undefined) {
    await tx.execute(sql`
      UPDATE interview_sessions
      SET status = ${patch.status}::interview_session_status
      WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
    `);
  }
  if (patch.mode !== undefined) {
    await tx.execute(sql`
      UPDATE interview_sessions
      SET mode = ${patch.mode}::interview_mode
      WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
    `);
  }
  if (patch.completed_at !== undefined) {
    await tx.execute(sql`
      UPDATE interview_sessions
      SET completed_at = ${patch.completed_at}::timestamptz
      WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
    `);
  }
  if (patch.duration_seconds !== undefined) {
    await tx.execute(sql`
      UPDATE interview_sessions
      SET duration_seconds = ${patch.duration_seconds}::integer
      WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
    `);
  }
}

/**
 * Runs `fn` inside a transaction with `SELECT … FOR UPDATE` on the session row.
 */
export async function withLockedInterviewSession<T>(
  sessionId: string,
  userId: string,
  fn: (ctx: LockedSessionContext) => Promise<T>
): Promise<T | null> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      SELECT *
      FROM interview_sessions
      WHERE id = ${sessionId}::uuid
        AND user_id = ${userId}::uuid
      FOR UPDATE
    `);

    const row = locked.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    const session = mapSessionRow(row);

    const updateSession = async (patch: SessionUpdatePatch) => {
      await applySessionPatch(tx, sessionId, userId, patch);
    };

    return fn({ session, updateSession });
  });
}
