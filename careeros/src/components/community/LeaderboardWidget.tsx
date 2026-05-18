"use client";

import Image from "next/image";
import Link from "next/link";

import type { LeaderboardEntryWithMeta } from "@/components/community/types";
import type { Profile } from "@/db/schema/profile";
import { PROFILE_TARGET_ROLE_LABELS } from "@/lib/profileDisplay";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export type LeaderboardWidgetProps = {
  cohortId: string;
  currentUserId: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function LeaderboardRow({
  entry,
  highlight,
}: {
  entry: LeaderboardEntryWithMeta;
  highlight?: boolean;
}) {
  const roleLabel =
    PROFILE_TARGET_ROLE_LABELS[
      entry.targetRole as Profile["targetRole"]
    ] ?? entry.targetRole;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-2 py-2",
        highlight && "rounded-lg bg-zinc-800/60",
      )}
    >
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-zinc-500">
        {entry.rank}
      </span>
      {entry.imageUrl ? (
        <Image
          src={entry.imageUrl}
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300"
          aria-hidden
        >
          {initials(entry.displayName)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-200">
          {entry.displayName}
        </p>
        <p className="truncate text-xs text-zinc-600">{roleLabel}</p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-300">
        {entry.score.toFixed(1)}
      </span>
    </li>
  );
}

export function LeaderboardWidget({
  cohortId,
  currentUserId,
}: LeaderboardWidgetProps) {
  const { data, isLoading } = api.community.leaderboard.getCohort.useQuery({
    cohortId,
    limit: 10,
  });

  if (isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-800/30" />
    );
  }

  const entries = data?.entries ?? [];
  const currentUserEntry = data?.currentUserEntry;
  const viewerInTop = entries.some((e) => e.userId === currentUserId);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Cohort leaderboard</h3>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No scores yet.</p>
      ) : (
        <ul className="mt-3 space-y-0.5">
          {entries.map((entry) => (
            <LeaderboardRow
              key={entry.id}
              entry={entry}
              highlight={entry.userId === currentUserId}
            />
          ))}

          {!viewerInTop && currentUserEntry ? (
            <>
              <li className="py-2 text-center text-xs tracking-widest text-zinc-600">
                ···
              </li>
              <LeaderboardRow entry={currentUserEntry} highlight />
            </>
          ) : null}
        </ul>
      )}

      <Link
        href="/community/leaderboard"
        className="mt-4 inline-block text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        Full leaderboard →
      </Link>
    </section>
  );
}
