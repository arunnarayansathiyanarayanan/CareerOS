export function RoadmapProgress({ pct }: { pct: number }) {
  const safe = Math.max(0, Math.min(100, pct));
  return (
    <section className="min-h-[88px] space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/35 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Roadmap
        </h2>
        <p className="text-sm font-medium text-zinc-200">
          {safe}% to AI-Native Ready
        </p>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-500"
          style={{ width: `${safe}%` }}
        />
      </div>
    </section>
  );
}
