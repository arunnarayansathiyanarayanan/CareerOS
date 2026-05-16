import type { LiveTranscriptEntry } from "@/hooks/use-interview";
import type { TranscriptEntry } from "@/lib/interviews/types";

export function transcriptToLiveEntries(
  transcript: TranscriptEntry[],
  sessionAudioUrls: Record<number, string>
): LiveTranscriptEntry[] {
  return transcript.map((entry) => ({
    role: entry.role,
    content: entry.content,
    timestamp_ms: entry.timestamp_ms,
    audioUrl:
      entry.role === "interviewer" && entry.turn_number != null
        ? sessionAudioUrls[entry.turn_number]
        : undefined,
  }));
}

export function formatReplayTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatDurationSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/** Interviewer turn_number → transcript timestamp_ms when that clip starts. */
export function buildTranscriptTurnStarts(
  transcript: TranscriptEntry[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const entry of transcript) {
    if (entry.role === "interviewer" && entry.turn_number != null) {
      map.set(entry.turn_number, entry.timestamp_ms);
    }
  }
  return map;
}

export function orderedAudioTurns(
  sessionAudioUrls: Record<number, string>
): number[] {
  return Object.keys(sessionAudioUrls)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
}

export function findAudioTurnAtTranscriptMs(
  ms: number,
  orderedTurns: number[],
  transcriptTurnStarts: Map<number, number>
): number {
  if (orderedTurns.length === 0) return 0;
  let chosen = orderedTurns[0]!;
  for (const turn of orderedTurns) {
    const start = transcriptTurnStarts.get(turn) ?? 0;
    if (start <= ms) chosen = turn;
    else break;
  }
  return chosen;
}

export function estimateTranscriptMs(
  turn: number,
  offsetSeconds: number,
  transcriptTurnStarts: Map<number, number>
): number {
  const start = transcriptTurnStarts.get(turn) ?? 0;
  return start + Math.round(offsetSeconds * 1000);
}

export function activeTranscriptIndex(
  transcript: LiveTranscriptEntry[],
  currentMs: number
): number {
  let active = 0;
  for (let i = 0; i < transcript.length; i++) {
    if (transcript[i]!.timestamp_ms <= currentMs) active = i;
    else break;
  }
  return active;
}

const MOMENT_HIGHLIGHT_WINDOW_MS = 4000;

export type ActiveMoment =
  | { kind: "strong"; index: number }
  | { kind: "improvement"; index: number }
  | null;

export function activeMomentAtTime(
  currentMs: number,
  strongMoments: { timestamp_ms: number }[],
  improvementMoments: { timestamp_ms: number }[]
): ActiveMoment {
  let best: ActiveMoment = null;
  let bestDelta = MOMENT_HIGHLIGHT_WINDOW_MS + 1;

  strongMoments.forEach((m, index) => {
    const delta = Math.abs(m.timestamp_ms - currentMs);
    if (delta <= MOMENT_HIGHLIGHT_WINDOW_MS && delta < bestDelta) {
      bestDelta = delta;
      best = { kind: "strong", index };
    }
  });

  improvementMoments.forEach((m, index) => {
    const delta = Math.abs(m.timestamp_ms - currentMs);
    if (delta <= MOMENT_HIGHLIGHT_WINDOW_MS && delta < bestDelta) {
      bestDelta = delta;
      best = { kind: "improvement", index };
    }
  });

  return best;
}

const ENTRY_MOMENT_WINDOW_MS = 5000;

export function entryMomentVariant(
  entryMs: number,
  strongMoments: { timestamp_ms: number }[],
  improvementMoments: { timestamp_ms: number }[]
): "strong" | "improvement" | null {
  let best: "strong" | "improvement" | null = null;
  let bestDelta = ENTRY_MOMENT_WINDOW_MS + 1;

  for (const m of strongMoments) {
    const delta = Math.abs(m.timestamp_ms - entryMs);
    if (delta <= ENTRY_MOMENT_WINDOW_MS && delta < bestDelta) {
      bestDelta = delta;
      best = "strong";
    }
  }
  for (const m of improvementMoments) {
    const delta = Math.abs(m.timestamp_ms - entryMs);
    if (delta <= ENTRY_MOMENT_WINDOW_MS && delta < bestDelta) {
      bestDelta = delta;
      best = "improvement";
    }
  }
  return best;
}

export function loadAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const finish = (value: number) => {
      audio.src = "";
      resolve(value);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(audio.duration || 0);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}
