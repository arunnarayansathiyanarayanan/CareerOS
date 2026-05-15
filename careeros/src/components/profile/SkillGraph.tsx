"use client";

import { memo, useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SkillGraphSkill = {
  skill: string;
  proficiency: number;
  source: "DECLARED" | "PROJECT_TAG" | "ENDORSEMENT";
};

const SOURCE_LABEL: Record<SkillGraphSkill["source"], string> = {
  DECLARED: "Declared",
  PROJECT_TAG: "Project tag",
  ENDORSEMENT: "Endorsement",
};

const SOURCE_PILL_CLASS: Record<SkillGraphSkill["source"], string> = {
  ENDORSEMENT: "border-violet-500/40 bg-violet-500/15 text-violet-200",
  PROJECT_TAG: "border-cyan-500/40 bg-cyan-500/15 text-cyan-200",
  DECLARED: "border-zinc-600 bg-zinc-800/60 text-zinc-300",
};

function truncateSkillLabel(name: string, max = 12): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function SkillGraph({ skills }: { skills: SkillGraphSkill[] }) {
  const chartData = useMemo(
    () =>
      skills.map((s) => ({
        skill: truncateSkillLabel(s.skill),
        value: Math.max(1, Math.min(5, s.proficiency)),
      })),
    [skills]
  );

  if (skills.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 text-center text-sm text-zinc-500">
        No skills yet — publish a project to auto-tag your stack
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/25 px-2 py-3">
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={chartData} cx="50%" cy="52%" outerRadius="78%">
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
          />
          <Radar
            name="Proficiency"
            dataKey="value"
            stroke="#8b5cf6"
            fill="rgba(139, 92, 246, 0.2)"
            fillOpacity={1}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="space-y-2 px-2 pb-1">
        <p className="text-xs text-zinc-500">
          {skills.length} {skills.length === 1 ? "skill" : "skills"}
        </p>
        <TooltipProvider delayDuration={200}>
          <ul className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <li key={`${s.skill}-${s.source}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "inline-flex cursor-default rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        SOURCE_PILL_CLASS[s.source]
                      )}
                    >
                      {s.skill}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {SOURCE_LABEL[s.source]}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </TooltipProvider>
      </div>
    </div>
  );
}

export default memo(SkillGraph);
