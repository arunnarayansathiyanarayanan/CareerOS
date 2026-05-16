"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSubModeLabel } from "@/lib/interviews/labels";
import type { RubricScores, SessionWithScore } from "@/lib/interviews/types";
import { cn } from "@/lib/utils";

export type HistoryCardProps = {
  session: SessionWithScore;
};

const RUBRIC_KEYS: (keyof RubricScores)[] = [
  "structure",
  "clarity",
  "ai_depth",
  "tradeoffs",
  "communication",
];

function overallScoreBadgeClass(score: number): string {
  if (score >= 8) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  if (score >= 6) return "border-indigo-500/40 bg-indigo-500/10 text-indigo-400";
  return "border-amber-500/40 bg-amber-500/10 text-amber-400";
}

function formatSessionDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}s`;
  if (secs === 0) return `${minutes} min`;
  return `${minutes}m ${secs}s`;
}

function MiniRubricBars({ scores }: { scores: RubricScores }) {
  return (
    <div
      className="flex h-8 items-end gap-1"
      aria-label="Rubric scores"
      title="Structure, clarity, AI depth, tradeoffs, communication"
    >
      {RUBRIC_KEYS.map((key) => {
        const score = scores[key];
        const pct = Math.min(100, Math.max(0, (score / 10) * 100));
        return (
          <div
            key={key}
            className="flex h-full w-2 flex-col justify-end rounded-sm bg-zinc-800"
          >
            <div
              className="w-full rounded-sm bg-indigo-500/90"
              style={{ height: `${pct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function HistoryCard({ session }: HistoryCardProps) {
  const subModeLabel = getSubModeLabel(session.sub_mode);
  const tryAgainHref = `/interview?subMode=${encodeURIComponent(session.sub_mode)}`;

  return (
    <article className="group relative rounded-xl border border-zinc-800 bg-[#1A1A1A] p-4 transition-colors hover:border-zinc-700 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:pr-28">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-zinc-100">{subModeLabel}</h3>
            {session.overall_score != null ? (
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
                  overallScoreBadgeClass(session.overall_score)
                )}
              >
                {session.overall_score.toFixed(1)}
              </span>
            ) : (
              <span className="text-xs text-zinc-500">Pending feedback</span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            {formatSessionDate(session.completed_at)}
            {" · "}
            {formatDuration(session.duration_seconds)}
          </p>
          {session.rubric_scores ? (
            <MiniRubricBars scores={session.rubric_scores} />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href={`/interview/${session.id}/feedback`}
            className="font-medium text-[#E5FF47] underline-offset-4 hover:underline"
          >
            View Feedback
          </Link>
          <Link
            href={`/interview/${session.id}/replay`}
            className="text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            Replay
          </Link>
        </div>
      </div>

      <div className="mt-3 opacity-100 transition-opacity sm:absolute sm:right-5 sm:top-5 sm:mt-0 sm:opacity-0 sm:group-hover:opacity-100">
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
        >
          <Link href={tryAgainHref}>Try again</Link>
        </Button>
      </div>
    </article>
  );
}


