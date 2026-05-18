"use client";

import { formatDistanceToNow, subDays } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  StreakEvent,
  StreakEventType,
} from "@/server/db/schema/community.schema";
import { cn } from "@/lib/utils";

const IST = "Asia/Kolkata";
const MILESTONES = [7, 30, 90] as const;

const SIZE_MAP = {
  sm: { px: 48, stroke: 4 },
  md: { px: 72, stroke: 6 },
  lg: { px: 96, stroke: 8 },
} as const;

const EVENT_ICONS: Record<StreakEventType, string> = {
  CONCEPT_COMPLETE: "🎯",
  PROJECT_PUBLISHED: "📦",
  INTERVIEW_DONE: "🎤",
  FEED_POST: "💬",
};

function ringColor(streak: number): string {
  if (streak >= 90) return "#ef4444";
  if (streak >= 30) return "#f97316";
  if (streak >= 7) return "#f59e0b";
  return "#52525b";
}

function nextMilestone(streak: number): number {
  const next = MILESTONES.find((m) => m > streak);
  return next ?? 90;
}

function last30DaysIST(): string[] {
  const dates: string[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    dates.push(
      format(toZonedTime(subDays(new Date(), i), IST), "yyyy-MM-dd"),
    );
  }
  return dates;
}

function shippedDates(events: StreakEvent[]): Set<string> {
  const set = new Set<string>();
  for (const event of events) {
    set.add(format(toZonedTime(event.occurredAt, IST), "yyyy-MM-dd"));
  }
  return set;
}

export type StreakRingProps = {
  currentStreak: number;
  longestStreak: number;
  size?: keyof typeof SIZE_MAP;
  recentEvents?: StreakEvent[];
};

function StreakHistoryModal({
  open,
  onOpenChange,
  currentStreak,
  longestStreak,
  recentEvents = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStreak: number;
  longestStreak: number;
  recentEvents?: StreakEvent[];
}) {
  const days = React.useMemo(() => last30DaysIST(), []);
  const shipped = React.useMemo(
    () => shippedDates(recentEvents),
    [recentEvents],
  );
  const recentList = recentEvents.slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Streak history</DialogTitle>
          <DialogDescription className="text-zinc-500">
            {currentStreak} day streak · best {longestStreak} days
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((date) => {
            const shippedDay = shipped.has(date);
            return (
              <div
                key={date}
                title={date}
                className={cn(
                  "h-4 w-4 rounded-sm",
                  shippedDay ? "bg-amber-400" : "bg-zinc-800",
                )}
              />
            );
          })}
        </div>

        {recentList.length > 0 ? (
          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto">
            {recentList.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-2 text-sm text-zinc-400"
              >
                <span aria-hidden>{EVENT_ICONS[event.eventType]}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-300">
                  {event.eventType.replaceAll("_", " ").toLowerCase()}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {formatDistanceToNow(event.occurredAt, { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            Ship something today to start your streak.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StreakRing({
  currentStreak,
  longestStreak,
  size = "md",
  recentEvents,
}: StreakRingProps) {
  const [open, setOpen] = React.useState(false);
  const { px, stroke } = SIZE_MAP[size];
  const radius = px / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const milestone = nextMilestone(currentStreak);
  const progress = Math.min(currentStreak / milestone, 1);
  const dashOffset = circumference * (1 - progress);
  const color = ringColor(currentStreak);
  const center = px / 2;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        aria-label={`${currentStreak} day streak. Open history.`}
      >
        <svg
          width={px}
          height={px}
          viewBox={`0 0 ${px} ${px}`}
          className="block"
          aria-hidden
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#27272a"
            strokeWidth={stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${center} ${center})`}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <span
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          style={{ width: px, height: px }}
        >
          <span className="font-bold leading-none text-white">
            {currentStreak}
          </span>
          <span className="text-xs text-zinc-400">days</span>
        </span>
      </button>

      <StreakHistoryModal
        open={open}
        onOpenChange={setOpen}
        currentStreak={currentStreak}
        longestStreak={longestStreak}
        recentEvents={recentEvents}
      />
    </>
  );
}
