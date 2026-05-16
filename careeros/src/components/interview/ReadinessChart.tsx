"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getTrackLabel } from "@/lib/interviews/labels";
import type { SessionWithScore, Track } from "@/lib/interviews/types";
import { cn } from "@/lib/utils";

export type TrackFilter = "all" | Track;

export type ReadinessChartProps = {
  sessions: SessionWithScore[];
  track: TrackFilter;
};

const TRACK_COLORS: Record<Track, string> = {
  ai_pm: "#E5FF47",
  ai_generalist: "#818cf8",
};

type ChartPoint = {
  date: string;
  completed_at: string;
  ai_pm?: number | null;
  ai_generalist?: number | null;
  ai_pm_id?: string | null;
  ai_generalist_id?: string | null;
};

function formatChartDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function lastSessionsPerTrack(
  sessions: SessionWithScore[],
  trackFilter: TrackFilter,
  maxPerTrack: number
): Record<Track, SessionWithScore[]> {
  const tracks: Track[] = ["ai_pm", "ai_generalist"];
  const result = { ai_pm: [], ai_generalist: [] } as Record<
    Track,
    SessionWithScore[]
  >;

  for (const t of tracks) {
    if (trackFilter !== "all" && trackFilter !== t) {
      result[t] = [];
      continue;
    }
    result[t] = sessions
      .filter((s) => s.track === t && s.overall_score != null)
      .sort(
        (a, b) =>
          new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
      )
      .slice(-maxPerTrack);
  }

  return result;
}

function buildChartData(
  sessions: SessionWithScore[],
  trackFilter: TrackFilter
): ChartPoint[] | null {
  const byTrack = lastSessionsPerTrack(sessions, trackFilter, 10);
  const scoredCount = byTrack.ai_pm.length + byTrack.ai_generalist.length;

  if (scoredCount < 2) return null;

  const dateKeys = new Set<string>();
  for (const list of Object.values(byTrack)) {
    for (const s of list) dateKeys.add(s.completed_at);
  }

  const sortedDates = [...dateKeys].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return sortedDates.map((completed_at) => {
    const point: ChartPoint = {
      date: formatChartDate(completed_at),
      completed_at,
    };

    for (const t of ["ai_pm", "ai_generalist"] as const) {
      const match = byTrack[t].find((s) => s.completed_at === completed_at);
      point[t] = match?.overall_score ?? null;
      point[`${t}_id`] = match?.id ?? null;
    }

    return point;
  });
}

function ClickableDot({
  cx,
  cy,
  payload,
  dataKey,
  onNavigate,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  dataKey?: string;
  onNavigate: (sessionId: string) => void;
}) {
  if (cx == null || cy == null || !payload || !dataKey) return null;

  const trackKey = dataKey as Track;
  const sessionId = payload[`${trackKey}_id` as keyof ChartPoint];
  const score = payload[trackKey];

  if (sessionId == null || score == null) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={TRACK_COLORS[trackKey]}
      stroke="#0A0A0A"
      strokeWidth={2}
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onNavigate(String(sessionId));
      }}
    />
  );
}

function ChartShell({
  children,
  className,
  empty = false,
}: {
  children: React.ReactNode;
  className?: string;
  empty?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-[#1A1A1A]",
        empty
          ? "flex items-center justify-center px-4 text-center text-sm text-zinc-500"
          : "px-2 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ReadinessChart({ sessions, track }: ReadinessChartProps) {
  const router = useRouter();
  const chartData = useMemo(
    () => buildChartData(sessions, track),
    [sessions, track]
  );

  const showPm =
    track === "all" || track === "ai_pm"
      ? sessions.some((s) => s.track === "ai_pm" && s.overall_score != null)
      : false;
  const showGen =
    track === "all" || track === "ai_generalist"
      ? sessions.some(
          (s) => s.track === "ai_generalist" && s.overall_score != null
        )
      : false;

  const handleNavigate = (sessionId: string) => {
    router.push(`/interview/${sessionId}/feedback`);
  };

  if (!chartData) {
    return (
      <ChartShell empty className="h-[220px]">
        Complete 2+ interviews to see your progress trend.
      </ChartShell>
    );
  }

  const lines: { key: Track; show: boolean }[] = [
    { key: "ai_pm", show: showPm && (track === "all" || track === "ai_pm") },
    {
      key: "ai_generalist",
      show: showGen && (track === "all" || track === "ai_generalist"),
    },
  ];

  return (
    <ChartShell className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
        >
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#3f3f46" }}
          />
          <YAxis
            domain={[1, 10]}
            ticks={[1, 3, 5, 7, 10]}
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#3f3f46" }}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value: number, name: string) => [
              value.toFixed(1),
              getTrackLabel(name as Track),
            ]}
          />
          {track === "all" && showPm && showGen ? (
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) => getTrackLabel(value as Track)}
            />
          ) : null}
          {lines
            .filter((line) => line.show)
            .map(({ key }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={TRACK_COLORS[key]}
                strokeWidth={2}
                dot={
                  <ClickableDot dataKey={key} onNavigate={handleNavigate} />
                }
                activeDot={{ r: 7, cursor: "pointer" }}
                connectNulls={false}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
