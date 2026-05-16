"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type FeedbackHelpfulnessProps = {
  sessionId: string;
  onRate?: (rating: 1 | 2 | 3 | 4 | 5) => void;
};

const STAR_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"] as const;

export function FeedbackHelpfulness({
  sessionId,
  onRate,
}: FeedbackHelpfulnessProps) {
  const [submitted, setSubmitted] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  if (submitted) {
    return (
      <p className="text-center text-sm text-zinc-400">
        Thanks for your feedback
      </p>
    );
  }

  const handleSelect = async (value: 1 | 2 | 3 | 4 | 5) => {
    if (disabled) return;

    setDisabled(true);
    setSelected(value);
    setSubmitted(true);
    onRate?.(value);

    try {
      const res = await fetch(`/api/interviews/${sessionId}/feedback/rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });

      if (!res.ok) {
        setSelected(null);
        setSubmitted(false);
        setDisabled(false);
      }
    } catch {
      setSelected(null);
      setSubmitted(false);
      setDisabled(false);
    }
  };

  const active = hovered ?? selected;

  return (
    <section className="rounded-xl border border-zinc-800 bg-[#141414] px-4 py-6 text-center">
      <p className="text-sm font-medium text-zinc-200">
        Was this feedback useful?
      </p>
      <div
        className="mt-4 flex justify-center gap-1"
        role="radiogroup"
        aria-label="Rate feedback helpfulness"
      >
        {([1, 2, 3, 4, 5] as const).map((value) => {
          const filled = active != null && value <= active;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              title={STAR_LABELS[value - 1]}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              className={cn(
                "rounded-lg px-2 py-1 text-2xl transition-transform",
                disabled ? "cursor-default" : "cursor-pointer hover:scale-110",
                filled ? "opacity-100" : "opacity-40"
              )}
              onMouseEnter={() => !disabled && setHovered(value)}
              onMouseLeave={() => !disabled && setHovered(null)}
              onClick={() => void handleSelect(value)}
            >
              {filled ? "⭐" : "☆"}
            </button>
          );
        })}
      </div>
    </section>
  );
}
