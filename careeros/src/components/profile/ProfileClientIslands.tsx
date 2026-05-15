"use client";

import dynamic from "next/dynamic";

import {
  ActivityTimelineSkeleton,
  SkillGraphSkeleton,
} from "@/components/profile/profile-skeletons";
import type { ProfileActivityItem } from "@/components/profile/ActivityTimeline";
import type { ProfileSkillGraphEntryDTO } from "@/server/routers/profile";

const SkillGraph = dynamic(
  () => import("@/components/profile/SkillGraph"),
  {
    ssr: false,
    loading: () => <SkillGraphSkeleton />,
  }
);

const ActivityTimeline = dynamic(
  () => import("@/components/profile/ActivityTimeline"),
  {
    ssr: false,
    loading: () => <ActivityTimelineSkeleton />,
  }
);

export function ProfileSkillGraphIsland({
  entries,
}: {
  entries: ProfileSkillGraphEntryDTO[];
}) {
  return (
    <div className="min-h-[320px] space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Skill graph
      </h2>
      <SkillGraph
        skills={entries.map((e) => ({
          skill: e.skill,
          source: e.source,
          proficiency: Math.max(1, Math.min(5, e.proficiency ?? 3)),
        }))}
      />
    </div>
  );
}

export function ProfileActivityIsland({
  items,
}: {
  items: ProfileActivityItem[];
}) {
  return (
    <section className="mt-12 min-h-[200px] space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Activity
      </h2>
      <ActivityTimeline items={items} />
    </section>
  );
}
