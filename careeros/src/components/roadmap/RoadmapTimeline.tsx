import { countReadinessStats } from "@/lib/calculateAiNativeReadyScore";
import type { GroupedRoadmap } from "@/types/roadmap";

import { ReadinessScore } from "./ReadinessScore";
import { RoadmapTimelineClient } from "./RoadmapTimelineClient";

export type RoadmapTimelineProps = {
  groupedRoadmap: GroupedRoadmap;
};

export function RoadmapTimeline({ groupedRoadmap }: RoadmapTimelineProps) {
  const { roadmap, phases } = groupedRoadmap;
  const items = phases.flatMap((phase) => phase.items);
  const stats = countReadinessStats(items);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      {roadmap.status === "stale" ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          Your roadmap is being updated. Showing last saved version.
        </p>
      ) : null}

      <header className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Your roadmap
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          {formatTargetRole(roadmap.targetRole)}
        </h1>
      </header>

      <ReadinessScore
        score={roadmap.aiNativeReadyScore}
        conceptsDone={stats.conceptsDone}
        projectsDone={stats.projectsDone}
        milestonesDone={stats.milestonesDone}
      />

      <RoadmapTimelineClient groupedRoadmap={groupedRoadmap} />
    </div>
  );
}

function formatTargetRole(role: string): string {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
