"use client";

import { useMemo, useState } from "react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  filterPhases,
  phaseCompletionPercent,
  ROADMAP_TYPE_FILTERS,
  type RoadmapTypeFilter,
} from "@/lib/roadmapDisplay";
import type { GroupedRoadmap } from "@/types/roadmap";

import { RoadmapItem } from "./RoadmapItem";

export type RoadmapTimelineClientProps = {
  groupedRoadmap: GroupedRoadmap;
};

export function RoadmapTimelineClient({
  groupedRoadmap,
}: RoadmapTimelineClientProps) {
  const [filter, setFilter] = useState<RoadmapTypeFilter>("all");

  const visiblePhases = useMemo(
    () => filterPhases(groupedRoadmap.phases, filter),
    [groupedRoadmap.phases, filter]
  );

  return (
    <div className="flex flex-col gap-8">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter roadmap items by type"
      >
        {ROADMAP_TYPE_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === id
                ? "border-[#E5FF47]/40 bg-[#E5FF47]/10 text-[#E5FF47]"
                : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visiblePhases.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          No items match this filter.
        </p>
      ) : (
        <ol className="relative space-y-10 pl-1">
          {visiblePhases.map((phase, phaseIndex) => {
            const completion = phaseCompletionPercent(phase.items);
            const isLastPhase = phaseIndex === visiblePhases.length - 1;

            return (
              <li key={`${phase.phaseOrder}-${phase.name}`} className="relative">
                {!isLastPhase && (
                  <span
                    className="absolute left-[11px] top-10 bottom-0 w-px bg-zinc-800"
                    aria-hidden
                  />
                )}

                <div className="flex gap-4">
                  <span
                    className="relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[10px] font-bold text-zinc-400"
                    aria-hidden
                  >
                    {phase.phaseOrder}
                  </span>

                  <div className="min-w-0 flex-1">
                    <header className="mb-4 space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-base font-semibold text-zinc-100">
                          {phase.name}
                        </h2>
                        <p className="text-xs tabular-nums text-zinc-500">
                          {phase.items.length}{" "}
                          {phase.items.length === 1 ? "item" : "items"} ·{" "}
                          {completion}% complete
                        </p>
                      </div>
                      <Progress
                        value={completion}
                        className="h-1 bg-zinc-800 [&_[data-slot=progress-indicator]]:bg-[#E5FF47]"
                      />
                    </header>

                    <ul className="space-y-3">
                      {phase.items.map((item) => (
                        <li key={item.id}>
                          <RoadmapItem item={item} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
