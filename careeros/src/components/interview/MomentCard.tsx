import { cn } from "@/lib/utils";

import type { FeedbackMoment } from "@/lib/ai/feedback-ai";

type MomentCardProps = {
  moment: FeedbackMoment;
  variant: "strong" | "improvement";
};

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function MomentCard({ moment, variant }: MomentCardProps) {
  return (
    <article
      className={cn(
        "rounded-lg border border-zinc-800 bg-[#141414] p-4",
        variant === "strong" ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-amber-500"
      )}
    >
      <p className="text-xs font-medium tabular-nums text-zinc-500">
        {formatTimestamp(moment.timestamp_ms)}
      </p>
      <blockquote className="mt-2 font-mono text-sm leading-relaxed text-zinc-200">
        &ldquo;{moment.quote_snippet}&rdquo;
      </blockquote>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{moment.reason}</p>
    </article>
  );
}
