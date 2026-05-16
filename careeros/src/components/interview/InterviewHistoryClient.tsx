"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { HistoryCard } from "@/components/interview/HistoryCard";
import {
  ReadinessChart,
  type TrackFilter,
} from "@/components/interview/ReadinessChart";
import { Button } from "@/components/ui/button";
import type { SessionWithScore } from "@/lib/interviews/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const FILTER_OPTIONS: { value: TrackFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ai_pm", label: "AI PM" },
  { value: "ai_generalist", label: "AI Generalist" },
];

export type InterviewHistoryClientProps = {
  sessions: SessionWithScore[];
  chartSessions: SessionWithScore[];
  total: number;
  serverPage: number;
  serverPageSize: number;
};

export function InterviewHistoryClient({
  sessions,
  chartSessions,
  total,
  serverPage,
  serverPageSize,
}: InterviewHistoryClientProps) {
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [clientPage, setClientPage] = useState(1);

  const filtered = useMemo(() => {
    if (trackFilter === "all") return sessions;
    return sessions.filter((s) => s.track === trackFilter);
  }, [sessions, trackFilter]);

  const clientPageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeClientPage = Math.min(clientPage, clientPageCount);

  const pageItems = useMemo(() => {
    const start = (safeClientPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safeClientPage]);

  const serverPageCount = Math.max(1, Math.ceil(total / serverPageSize));
  const hasServerPrev = serverPage > 1;
  const hasServerNext = serverPage < serverPageCount;

  const handleFilterChange = (value: TrackFilter) => {
    setTrackFilter(value);
    setClientPage(1);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">Progress trend</h2>
        <ReadinessChart sessions={chartSessions} track={trackFilter} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium text-zinc-300">Past interviews</h2>
          <div
            className="flex flex-wrap gap-1 rounded-lg border border-zinc-800 bg-[#141414] p-1"
            role="tablist"
            aria-label="Filter by track"
          >
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={trackFilter === opt.value}
                onClick={() => handleFilterChange(opt.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  trackFilter === opt.value
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {pageItems.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-[#1A1A1A] px-4 py-10 text-center text-sm text-zinc-500">
            {sessions.length === 0
              ? "No completed interviews yet. Finish a mock interview to see it here."
              : "No interviews match this filter."}
          </p>
        ) : (
          <ul className="space-y-3">
            {pageItems.map((session) => (
              <li key={session.id}>
                <HistoryCard session={session} />
              </li>
            ))}
          </ul>
        )}

        {(clientPageCount > 1 || hasServerPrev || hasServerNext) && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-zinc-500">
              {filtered.length} {filtered.length === 1 ? "session" : "sessions"}
              {trackFilter !== "all" ? " in this view" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeClientPage <= 1}
                onClick={() => setClientPage((p) => Math.max(1, p - 1))}
                className="h-8 border-zinc-700 text-zinc-300"
              >
                Previous
              </Button>
              <span className="text-xs tabular-nums text-zinc-500">
                {safeClientPage} / {clientPageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeClientPage >= clientPageCount}
                onClick={() =>
                  setClientPage((p) => Math.min(clientPageCount, p + 1))
                }
                className="h-8 border-zinc-700 text-zinc-300"
              >
                Next
              </Button>
            </div>
            {(hasServerPrev || hasServerNext) && (
              <div className="flex w-full items-center justify-end gap-2 border-t border-zinc-800/80 pt-3 sm:w-auto sm:border-0 sm:pt-0">
                <span className="text-xs text-zinc-600">Older sessions</span>
                {hasServerPrev ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 text-zinc-400"
                  >
                    <Link href={`/interview/history?page=${serverPage - 1}`}>
                      Prev batch
                    </Link>
                  </Button>
                ) : null}
                {hasServerNext ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 text-zinc-400"
                  >
                    <Link href={`/interview/history?page=${serverPage + 1}`}>
                      Next batch
                    </Link>
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
