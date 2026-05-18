"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";

import type { SalaryChartSkill } from "./types";

export type SalaryChartProps = {
  skills: SalaryChartSkill[];
  isLoading?: boolean;
};

type ChartRow = SalaryChartSkill & {
  range: number;
  label: string;
};

function SalaryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-zinc-100">{row.name}</p>
      <p className="mt-1 text-zinc-400">
        P25 {row.salaryP25.toFixed(1)} · P50{" "}
        <span className="text-indigo-300">{row.salaryP50.toFixed(1)}</span> · P75{" "}
        {row.salaryP75.toFixed(1)} LPA
      </p>
    </div>
  );
}

/** Horizontal salary band chart (P25–P75) with P50 encoded in bar opacity. */
export function SalaryChart({ skills, isLoading = false }: SalaryChartProps) {
  const data = useMemo<ChartRow[]>(
    () =>
      skills.map((skill) => ({
        ...skill,
        label: skill.name,
        range: Math.max(skill.salaryP75 - skill.salaryP25, 0.1),
      })),
    [skills],
  );

  const domainMax = useMemo(() => {
    const maxP75 = Math.max(...data.map((d) => d.salaryP75), 0);
    return Math.ceil(maxP75 * 1.15);
  }, [data]);

  if (isLoading) {
    return <Skeleton className="h-[360px] w-full rounded-2xl" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-zinc-800/90 bg-zinc-900/30 text-sm text-zinc-500">
        Not enough salary data for the current filters.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-4 sm:p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
          Salary bands (top 10)
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Bar spans P25–P75 LPA; brighter segment marks P50.
        </p>
      </header>

      <div className="h-[min(420px,52vh)] w-full min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            barCategoryGap="18%"
          >
            <defs>
              <linearGradient id="salaryBandGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="50%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#27272a"
            />
            <XAxis
              type="number"
              domain={[0, domainMax]}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={false}
              unit=" LPA"
            />
            <YAxis
              type="category"
              dataKey="label"
              width={108}
              tick={{ fill: "#d4d4d8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(39, 39, 42, 0.45)" }}
              content={<SalaryTooltip />}
            />
            <Bar dataKey="salaryP25" stackId="band" fill="transparent" />
            <Bar dataKey="range" stackId="band" radius={[0, 4, 4, 0]}>
              {data.map((row) => {
                const p50Offset =
                  row.range > 0 ?
                    (row.salaryP50 - row.salaryP25) / row.range
                  : 0.5;
                const clamped = Math.min(Math.max(p50Offset, 0), 1);
                return (
                  <Cell
                    key={row.skillId}
                    fill="url(#salaryBandGradient)"
                    style={{
                      opacity: 0.95,
                      filter: `brightness(${0.75 + clamped * 0.35})`,
                    }}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
