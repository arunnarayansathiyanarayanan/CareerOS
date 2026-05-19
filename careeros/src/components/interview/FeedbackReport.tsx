"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { FeedbackHelpfulness } from "@/components/interview/FeedbackHelpfulness";
import { MomentCard } from "@/components/interview/MomentCard";
import { RubricScore } from "@/components/interview/RubricScore";
import { Button } from "@/components/ui/button";
import type { ParsedFeedback } from "@/lib/ai/feedback-ai";
import { PRODUCT_DOMAIN } from "@/lib/brand";
import { getSubModeLabel, getTrackLabel } from "@/lib/interviews/labels";
import type { InterviewSession } from "@/lib/interviews/types";
import { cn } from "@/lib/utils";

export type FeedbackReportProps = {
  feedback: ParsedFeedback;
  session: InterviewSession;
  sessionId: string;
  helpfulnessRating: number | null;
  onRate: (rating: 1 | 2 | 3 | 4 | 5) => void;
};

function overallScoreColor(score: number): string {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-indigo-400";
  return "text-amber-400";
}

function formatSessionDate(iso: string | null): string {
  if (!iso) return "—";
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

function buildLinkedInShareText(score: number, subModeLabel: string): string {
  return `Just completed an AI PM interview on Aihired and scored ${score.toFixed(1)}/10 on ${subModeLabel}. Track your AI career at ${PRODUCT_DOMAIN}`;
}

export function FeedbackReport({
  feedback,
  session,
  sessionId,
  helpfulnessRating,
  onRate,
}: FeedbackReportProps) {
  const [rated, setRated] = useState(helpfulnessRating != null);
  const trackLabel = getTrackLabel(session.track);
  const subModeLabel = getSubModeLabel(session.sub_mode);
  const nextSubMode = feedback.recommended_next_sub_mode;
  const nextSubModeLabel = getSubModeLabel(nextSubMode);

  const handleRate = useCallback(
    (rating: 1 | 2 | 3 | 4 | 5) => {
      setRated(true);
      onRate(rating);
    },
    [onRate]
  );

  const handleShare = async () => {
    const text = buildLinkedInShareText(feedback.overall_score, subModeLabel);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied — paste into LinkedIn when you're ready");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-3 text-center sm:text-left">
        <p
          className={cn(
            "text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl",
            overallScoreColor(feedback.overall_score)
          )}
        >
          {feedback.overall_score.toFixed(1)}
          <span className="text-2xl font-normal text-zinc-500 sm:text-3xl">
            {" "}
            / 10
          </span>
        </p>
        <p className="text-sm text-zinc-300">
          {trackLabel} · {subModeLabel}
        </p>
        <p className="text-xs text-zinc-500">
          {formatSessionDate(session.completed_at ?? session.started_at)}
          {" · "}
          {formatDuration(session.duration_seconds)}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">Rubric scores</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
          {(
            [
              ["Structure", feedback.rubric_scores.structure],
              ["Clarity", feedback.rubric_scores.clarity],
              ["AI Depth", feedback.rubric_scores.ai_depth],
              ["Tradeoffs", feedback.rubric_scores.tradeoffs],
              ["Communication", feedback.rubric_scores.communication],
            ] as const
          ).map(([label, score]) => (
            <div key={label} className="min-w-0 flex-1">
              <RubricScore label={label} score={score} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-emerald-400/90">
          ✦ What You Did Well
        </h2>
        <div className="space-y-3">
          {feedback.strong_moments.map((moment, i) => (
            <MomentCard key={`strong-${i}`} moment={moment} variant="strong" />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-amber-400/90">
          → Where To Improve
        </h2>
        <div className="space-y-3">
          {feedback.improvement_moments.map((moment, i) => (
            <MomentCard
              key={`improve-${i}`}
              moment={moment}
              variant="improvement"
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#E5FF47]/30 bg-[#E5FF47]/5 p-5">
        <p className="text-sm text-zinc-200">
          Your next recommended interview:{" "}
          <span className="font-medium text-zinc-50">{nextSubModeLabel}</span>
        </p>
        <Button
          asChild
          className="mt-4 h-10 bg-[#E5FF47] text-sm font-semibold text-[#111] hover:bg-[#d8f542]"
        >
          <Link href={`/interview?subMode=${encodeURIComponent(nextSubMode)}`}>
            Practice {nextSubModeLabel} →
          </Link>
        </Button>
      </section>

      {!rated ? (
        <FeedbackHelpfulness sessionId={sessionId} onRate={handleRate} />
      ) : null}

      <footer className="flex flex-col gap-3 border-t border-zinc-800 pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            asChild
            variant="outline"
            className="h-10 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          >
            <Link href={`/interview/${sessionId}/replay`}>Replay Interview</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleShare()}
            className="h-10 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          >
            Share your score
          </Button>
        </div>
        <Link
          href="/interview"
          className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
        >
          ← Back to Interview Home
        </Link>
      </footer>
    </div>
  );
}
