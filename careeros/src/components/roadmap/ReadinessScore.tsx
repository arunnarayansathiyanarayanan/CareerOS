"use client";

import { useEffect, useState, type ReactNode } from "react";

import { getScoreLabel } from "@/lib/calculateAiNativeReadyScore";
import { cn } from "@/lib/utils";

export type ReadinessScoreProps = {
  score: number;
  conceptsDone: number;
  projectsDone: number;
  milestonesDone: number;
  className?: string;
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getRingColorClass(score: number): string {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 50) return "stroke-blue-500";
  if (score >= 25) return "stroke-amber-500";
  return "stroke-red-500";
}

function StatPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
      {children}
    </span>
  );
}

export function ReadinessScore({
  score,
  conceptsDone,
  projectsDone,
  milestonesDone,
  className,
}: ReadinessScoreProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const label = getScoreLabel(clamped);
  const targetOffset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const ringColor = getRingColorClass(clamped);

  const [strokeOffset, setStrokeOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setStrokeOffset(targetOffset);
    });
    return () => cancelAnimationFrame(frame);
  }, [targetOffset]);

  return (
    <section
      className={cn(
        "flex flex-col items-center gap-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm dark:border-zinc-800/90 dark:bg-zinc-950/80",
        className
      )}
      aria-label="AI-Native Ready score"
    >
      <div className="relative size-36 shrink-0">
        <svg
          className="size-full -rotate-90"
          viewBox="0 0 100 100"
          role="img"
          aria-label={`${clamped}% AI-Native Ready`}
        >
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            className={cn(
              ringColor,
              "transition-[stroke-dashoffset] duration-1000 ease-out"
            )}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          <span className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            {clamped}%
          </span>
          <span className="mt-0.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <StatPill>
          {conceptsDone} concept{conceptsDone === 1 ? "" : "s"} done
        </StatPill>
        <StatPill>
          {projectsDone} project{projectsDone === 1 ? "" : "s"} shipped
        </StatPill>
        <StatPill>
          {milestonesDone} milestone{milestonesDone === 1 ? "" : "s"} hit
        </StatPill>
      </div>
    </section>
  );
}
