"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import type { ViewSource } from "@/server/routers/profile";
import { trpc } from "@/trpc/react";

const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

const SOURCE_ORDER: ViewSource[] = [
  "DIRECT",
  "LINKEDIN",
  "TWITTER",
  "WHATSAPP",
  "GOOGLE",
  "OTHER",
];

const SOURCE_LABEL: Record<ViewSource, string> = {
  DIRECT: "Direct",
  LINKEDIN: "LinkedIn",
  TWITTER: "Twitter",
  WHATSAPP: "WhatsApp",
  GOOGLE: "Google",
  OTHER: "Other",
};

function viewerLabelFromSource(source: string): string {
  switch (source) {
    case "LINKEDIN":
      return "Someone from LinkedIn";
    case "TWITTER":
      return "Someone from Twitter";
    case "WHATSAPP":
      return "Someone from WhatsApp";
    case "GOOGLE":
      return "Someone from Google";
    default:
      return "Someone";
  }
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";

  const diffSec = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diffSec);

  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 604800), "week");
  return rtf.format(Math.round(diffSec / 2592000), "month");
}

export function ProfileViewsPanel({ isOwner }: { isOwner: boolean }) {
  if (!isOwner) return null;

  const { data, isLoading, isError } = trpc.profile.getViewStats.useQuery(
    undefined,
    { refetchInterval: REFETCH_INTERVAL_MS }
  );

  const totalViews = data?.totalLast30Days ?? 0;

  const viewsBySource = useMemo(
    () =>
      SOURCE_ORDER.map((source) => ({
        source: SOURCE_LABEL[source],
        count: data?.bySource[source] ?? 0,
      })),
    [data?.bySource]
  );

  const recentViewers = useMemo(
    () =>
      (data?.lastViewers ?? []).map((row) => ({
        label: viewerLabelFromSource(row.source),
        viewedAt: row.viewedAt,
      })),
    [data?.lastViewers]
  );

  const maxCount = Math.max(1, ...viewsBySource.map((row) => row.count));
  const isEmpty = !isLoading && totalViews === 0 && recentViewers.length === 0;

  return (
    <section className="mt-6" aria-label="Profile view analytics">
      <Accordion
        type="single"
        collapsible
        className="rounded-2xl border border-zinc-800 bg-zinc-900/25 px-4"
      >
        <AccordionItem value="views" className="border-0">
          <AccordionTrigger className="text-zinc-300 hover:text-zinc-100 hover:no-underline">
            👁 {isLoading ? "…" : totalViews} profile views this month
          </AccordionTrigger>
          <AccordionContent>
            {isLoading ? (
              <div className="space-y-3 pb-2">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : isError ? (
              <p className="pb-2 text-sm text-zinc-500">
                Couldn&apos;t load view stats. Try again in a moment.
              </p>
            ) : isEmpty ? (
              <p className="pb-2 text-sm text-zinc-500">
                No views yet — share your profile link
              </p>
            ) : (
              <div className="space-y-4 pb-2">
                <div className="h-[168px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={viewsBySource}
                      layout="vertical"
                      margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide domain={[0, maxCount]} />
                      <YAxis
                        type="category"
                        dataKey="source"
                        width={76}
                        tick={{ fill: "#a1a1aa", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                        {viewsBySource.map((row) => (
                          <Cell
                            key={row.source}
                            fill="#8b5cf6"
                            fillOpacity={row.count > 0 ? 0.9 : 0.25}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {recentViewers.length > 0 ? (
                  <ul className="space-y-2 border-t border-zinc-800 pt-4">
                    {recentViewers.map((viewer, index) => (
                      <li
                        key={`${viewer.viewedAt}-${index}`}
                        className="text-sm text-zinc-400"
                      >
                        <span className="text-zinc-300">{viewer.label}</span>
                        {" viewed your profile · "}
                        <time dateTime={viewer.viewedAt}>
                          {formatRelativeTime(viewer.viewedAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
