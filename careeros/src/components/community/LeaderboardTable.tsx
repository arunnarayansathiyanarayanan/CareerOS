"use client";

import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import * as React from "react";

import type {
  LeaderboardEntryWithMeta,
  LeaderboardPageData,
} from "@/components/community/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Profile } from "@/db/schema/profile";
import { PROFILE_TARGET_ROLE_LABELS } from "@/lib/profileDisplay";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const PAGE_SIZE = 50;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function rankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

function scoreBreakdown(entry: LeaderboardEntryWithMeta): string {
  const projectsPart =
    entry.projectsShipped * entry.projectQualitySum * 0.5;
  const interviewPart = entry.interviewScoreGrowth * 0.3;
  const communityPart = entry.communityContribution * 0.2;
  return [
    `Projects: ${entry.projectsShipped} × ${entry.projectQualitySum.toFixed(1)} × 0.5 = ${projectsPart.toFixed(1)}`,
    `Interview growth: ${entry.interviewScoreGrowth.toFixed(1)} × 0.3 = ${interviewPart.toFixed(1)}`,
    `Community: ${entry.communityContribution.toFixed(1)} × 0.2 = ${communityPart.toFixed(1)}`,
    `Total: ${entry.score.toFixed(1)}`,
  ].join("\n");
}

function RoleBadge({ targetRole }: { targetRole: string }) {
  const label =
    PROFILE_TARGET_ROLE_LABELS[targetRole as Profile["targetRole"]] ??
    targetRole;
  return (
    <span className="inline-flex max-w-[8rem] truncate rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
      {label}
    </span>
  );
}

function UserCell({ entry }: { entry: LeaderboardEntryWithMeta }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {entry.imageUrl ? (
        <Image
          src={entry.imageUrl}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300"
          aria-hidden
        >
          {initials(entry.displayName)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-100">
          {entry.displayName}
        </p>
        <RoleBadge targetRole={entry.targetRole} />
      </div>
    </div>
  );
}

function ScoreCell({ entry }: { entry: LeaderboardEntryWithMeta }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help font-medium tabular-nums text-zinc-100">
          {entry.score.toFixed(1)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">
        {scoreBreakdown(entry)}
      </TooltipContent>
    </Tooltip>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
  variant,
}: {
  entry: LeaderboardEntryWithMeta;
  isCurrentUser: boolean;
  variant: "table" | "card";
}) {
  const rowClass = cn(
    isCurrentUser && "ring-1 ring-amber-400/40 bg-amber-400/5 rounded",
  );

  if (variant === "card") {
    return (
      <article className={cn("border border-zinc-800 p-4", rowClass)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg tabular-nums text-zinc-500">
              {rankLabel(entry.rank)}
            </span>
            <UserCell entry={entry} />
          </div>
          <ScoreCell entry={entry} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
          <div>
            <dt className="text-zinc-600">Projects</dt>
            <dd className="tabular-nums text-zinc-300">
              {entry.projectsShipped}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">Interview</dt>
            <dd className="tabular-nums text-zinc-300">
              {entry.interviewScoreGrowth.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">Community</dt>
            <dd className="tabular-nums text-zinc-300">
              {entry.communityContribution.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">Computed</dt>
            <dd className="text-zinc-400">
              {formatDistanceToNow(entry.computedAt, { addSuffix: true })}
            </dd>
          </div>
        </dl>
      </article>
    );
  }

  return (
    <tr className={rowClass}>
      <td className="px-3 py-3 text-center text-sm tabular-nums text-zinc-500">
        {rankLabel(entry.rank)}
      </td>
      <td className="px-3 py-3">
        <UserCell entry={entry} />
      </td>
      <td className="px-3 py-3 text-right">
        <ScoreCell entry={entry} />
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums text-zinc-400">
        {entry.projectsShipped}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums text-zinc-400">
        {entry.interviewScoreGrowth.toFixed(1)}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums text-zinc-400">
        {entry.communityContribution.toFixed(1)}
      </td>
      <td className="px-3 py-3 text-right text-xs text-zinc-500">
        {formatDistanceToNow(entry.computedAt, { addSuffix: true })}
      </td>
    </tr>
  );
}

export type LeaderboardTableProps = {
  initialData: LeaderboardPageData;
  cohortId?: string;
  currentUserId: string;
  defaultScope?: "cohort" | "global";
};

export function LeaderboardTable({
  initialData,
  cohortId,
  currentUserId,
  defaultScope = cohortId ? "cohort" : "global",
}: LeaderboardTableProps) {
  const [scope, setScope] = React.useState<"cohort" | "global">(defaultScope);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    setOffset(0);
  }, [scope]);

  const cohortQuery = api.community.leaderboard.getCohort.useQuery(
    { cohortId: cohortId!, limit: PAGE_SIZE, offset },
    {
      enabled: scope === "cohort" && Boolean(cohortId),
      initialData: scope === "cohort" && offset === 0 ? initialData : undefined,
    },
  );

  const globalQuery = api.community.leaderboard.getGlobal.useQuery(
    { limit: PAGE_SIZE, offset },
    {
      enabled: scope === "global",
      initialData:
        scope === "global" && offset === 0 ? initialData : undefined,
    },
  );

  const activeQuery = scope === "cohort" ? cohortQuery : globalQuery;
  const data = activeQuery.data;
  const entries = data?.entries ?? [];
  const totalCount = data?.totalCount ?? 0;
  const computedAt = data?.computedAt ?? new Date();
  const currentUserEntry = data?.currentUserEntry;
  const viewerInPage = entries.some((e) => e.userId === currentUserId);

  const rangeStart = totalCount === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + entries.length, totalCount);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < totalCount;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-lg border border-zinc-800 p-0.5">
            <button
              type="button"
              disabled={!cohortId}
              onClick={() => setScope("cohort")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                scope === "cohort"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
                !cohortId && "cursor-not-allowed opacity-40",
              )}
            >
              My Cohort
            </button>
            <button
              type="button"
              onClick={() => setScope("global")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                scope === "global"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              Global
            </button>
          </div>

          <span className="text-xs text-zinc-500">
            Updated {formatDistanceToNow(computedAt)} ago
          </span>
        </div>

        {activeQuery.isLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-zinc-800/40" />
        ) : entries.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            No leaderboard entries yet. Ship a project to appear here.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2 font-medium">Rank</th>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 text-right font-medium">Score</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Projects
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Interview Growth
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Community
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Computed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {entries.map((entry) => (
                    <LeaderboardRow
                      key={entry.id}
                      entry={entry}
                      isCurrentUser={entry.userId === currentUserId}
                      variant="table"
                    />
                  ))}
                  {!viewerInPage && currentUserEntry ? (
                    <>
                      <tr>
                        <td
                          colSpan={7}
                          className="py-2 text-center text-xs tracking-widest text-zinc-600"
                        >
                          ···
                        </td>
                      </tr>
                      <LeaderboardRow
                        entry={currentUserEntry}
                        isCurrentUser
                        variant="table"
                      />
                    </>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {entries.map((entry) => (
                <LeaderboardRow
                  key={entry.id}
                  entry={entry}
                  isCurrentUser={entry.userId === currentUserId}
                  variant="card"
                />
              ))}
              {!viewerInPage && currentUserEntry ? (
                <LeaderboardRow
                  entry={currentUserEntry}
                  isCurrentUser
                  variant="card"
                />
              ) : null}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-500">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrev || activeQuery.isFetching}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canNext || activeQuery.isFetching}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
