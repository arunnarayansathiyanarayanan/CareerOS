"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type RubricScoreProps = {
  label: string;
  score: number;
};

export function RubricScore({ label, score }: RubricScoreProps) {
  const [filled, setFilled] = useState(false);
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));

  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <span className="text-xs tabular-nums text-zinc-300">{score.toFixed(1)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn(
            "h-full rounded-full bg-indigo-500 transition-[width] duration-700 ease-out"
          )}
          style={{ width: filled ? `${pct}%` : "0%" }}
        />
      </div>
    </div>
  );
}
