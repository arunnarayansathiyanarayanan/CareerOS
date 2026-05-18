"use client";

import { AlertTriangleIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { SkillTableRow } from "./types";

export type SkillRankTableProps = {
  title: string;
  skills: SkillTableRow[];
  showChange: boolean;
  isStale?: boolean;
  isLoading?: boolean;
  computedAt?: string | null;
};

function formatSalary(lpa: number | null): string {
  if (lpa == null) return "—";
  return `${lpa.toFixed(1)} LPA`;
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change == null || change === 0) {
    return <span className="text-zinc-600">—</span>;
  }

  const positive = change > 0;
  const abs = Math.abs(change);
  const label =
    abs >= 10 ? `${positive ? "▲" : "▼"}${Math.round(abs)}%` : (
      `${positive ? "▲" : "▼"}${abs.toFixed(1)}%`
    );

  return (
    <span
      className={cn(
        "font-mono text-xs font-medium tabular-nums",
        positive ? "text-emerald-400" : "text-rose-400",
      )}
    >
      {label}
    </span>
  );
}

export function SkillRankTable({
  title,
  skills,
  showChange,
  isStale = false,
  isLoading = false,
  computedAt,
}: SkillRankTableProps) {
  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/30">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
            {title}
          </h2>
          {computedAt ? (
            <p className="mt-0.5 text-xs text-zinc-500">
              Snapshot{" "}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(computedAt))}
            </p>
          ) : null}
        </div>
        {isStale ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
            <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
            Data may be stale (&gt;7 days old)
          </div>
        ) : null}
      </header>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">
          No skills match these filters yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/60 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5 font-medium sm:px-5">#</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">Skill</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">Postings</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">P50 salary</th>
                {showChange ? (
                  <th className="px-4 py-2.5 font-medium sm:px-5">WoW</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr
                  key={`${skill.rank}-${skill.name}`}
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-500 sm:px-5">
                    {skill.rank}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-100 sm:px-5">
                    {skill.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-zinc-300 sm:px-5">
                    {skill.postingCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-zinc-300 sm:px-5">
                    {formatSalary(skill.salaryP50)}
                  </td>
                  {showChange ? (
                    <td className="px-4 py-2.5 sm:px-5">
                      <ChangeBadge change={skill.change} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
