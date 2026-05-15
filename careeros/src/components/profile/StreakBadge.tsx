import { Flame } from "lucide-react";

export function StreakBadge({ days }: { days: number }) {
  return (
    <div className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-orange-900/40 bg-orange-950/25 px-5 py-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
        <Flame className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-200/90">
          Building streak
        </p>
        <p className="text-2xl font-bold tabular-nums text-white">{days}</p>
        <p className="text-sm text-zinc-400">consecutive days</p>
      </div>
    </div>
  );
}
