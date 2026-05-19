"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useId } from "react";

import { Button } from "@/components/ui/button";
import { getAppOrigin } from "@/lib/brand";
import type {
  RoadmapContent,
  RoadmapItem,
} from "@/lib/legacyRoadmapJson";

const APP_ORIGIN = getAppOrigin();

function flattenItems(content: RoadmapContent): RoadmapItem[] {
  return content.phases.flatMap((p) => p.items);
}

function firstOfType(
  items: RoadmapItem[],
  type: RoadmapItem["type"]
): RoadmapItem | undefined {
  return items.find((i) => i.type === type);
}

function firstThreeActions(content: RoadmapContent): RoadmapItem[] {
  return flattenItems(content).slice(0, 3);
}

export function buildCareerosProfileUrl(username: string | null): string {
  if (!username?.trim()) return APP_ORIGIN;
  return `${APP_ORIGIN}/u/${encodeURIComponent(username.trim())}`;
}

function buildLinkedInShareUrl(text: string): string {
  const params = new URLSearchParams({ text });
  return `https://www.linkedin.com/feed/?shareActive=true&${params.toString()}`;
}

const STAGGER = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.06 },
  },
} as const;

const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
  },
} as const;

const TYPE_LABEL: Record<RoadmapItem["type"], string> = {
  concept: "Concept",
  project: "Project",
  milestone: "Milestone",
};

function TeaserSubtitle(item: RoadmapItem): string {
  if (item.type === "concept") return item.resources[0]?.title ?? item.description;
  if (item.type === "project")
    return item.problemStatement.slice(0, 120) +
      (item.problemStatement.length > 120 ? "…" : "");
  return item.deliverable;
}

type TeaserSlot = {
  type: RoadmapItem["type"];
  item?: RoadmapItem;
};

function buildTeaserSlots(content: RoadmapContent): TeaserSlot[] {
  const flat = flattenItems(content);
  return [
    { type: "concept", item: firstOfType(flat, "concept") },
    { type: "project", item: firstOfType(flat, "project") },
    { type: "milestone", item: firstOfType(flat, "milestone") },
  ];
}

/** 14 muted primitives — drift + fade, no confetti. */
function CelebrationField() {
  const specs = useMemo(
    () =>
      [
        { shape: "dot" as const, left: 6, top: 12, size: 3, driftX: 18, driftY: -10, dur: 14 },
        { shape: "sq" as const, left: 88, top: 8, size: 4, driftX: -12, driftY: 16, dur: 18 },
        { shape: "dot" as const, left: 14, top: 78, size: 2, driftX: 22, driftY: 8, dur: 16 },
        { shape: "sq" as const, left: 72, top: 22, size: 3, driftX: -20, driftY: -12, dur: 20 },
        { shape: "line" as const, left: 42, top: 6, w: 10, h: 1, driftX: 6, driftY: 14, dur: 17 },
        { shape: "dot" as const, left: 92, top: 62, size: 3, driftX: -16, driftY: -8, dur: 15 },
        { shape: "sq" as const, left: 24, top: 36, size: 2, driftX: 10, driftY: -18, dur: 19 },
        { shape: "dot" as const, left: 58, top: 88, size: 2, driftX: -8, driftY: -14, dur: 21 },
        { shape: "line" as const, left: 8, top: 48, w: 12, h: 1, driftX: 14, driftY: 6, dur: 16 },
        { shape: "sq" as const, left: 48, top: 14, size: 3, driftX: -6, driftY: 20, dur: 18 },
        { shape: "dot" as const, left: 80, top: 42, size: 2, driftX: -22, driftY: 10, dur: 17 },
        { shape: "sq" as const, left: 34, top: 68, size: 4, driftX: 16, driftY: -6, dur: 22 },
        { shape: "dot" as const, left: 64, top: 8, size: 2, driftX: 8, driftY: 22, dur: 20 },
        { shape: "line" as const, left: 90, top: 36, w: 8, h: 1, driftX: -10, driftY: -16, dur: 19 },
      ] as const,
    []
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      aria-hidden
    >
      {specs.map((s, i) => {
        const base = "absolute bg-zinc-500/35";
        const delay = i * 0.07;
        if (s.shape === "dot") {
          return (
            <motion.span
              key={i}
              className={`${base} rounded-full`}
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
              }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 0.42, 0.38, 0.45],
                x: [0, s.driftX * 0.35, s.driftX * 0.7, s.driftX],
                y: [0, s.driftY * 0.4, s.driftY * 0.75, s.driftY],
              }}
              transition={{
                opacity: { duration: 1.4, delay, ease: "easeOut" },
                x: { duration: s.dur, delay, repeat: Infinity, repeatType: "mirror", ease: "linear" },
                y: { duration: s.dur * 1.08, delay, repeat: Infinity, repeatType: "mirror", ease: "linear" },
              }}
            />
          );
        }
        if (s.shape === "sq") {
          return (
            <motion.span
              key={i}
              className={`${base} rotate-12`}
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
              }}
              initial={{ opacity: 0, x: 0, y: 0, rotate: 12 }}
              animate={{
                opacity: [0, 0.38, 0.32, 0.4],
                x: [0, s.driftX * 0.5, s.driftX],
                y: [0, s.driftY * 0.55, s.driftY],
                rotate: [12, 18, 6, 12],
              }}
              transition={{
                opacity: { duration: 1.2, delay: delay + 0.05, ease: "easeOut" },
                x: { duration: s.dur, delay, repeat: Infinity, repeatType: "mirror", ease: "linear" },
                y: { duration: s.dur * 0.95, delay, repeat: Infinity, repeatType: "mirror", ease: "linear" },
                rotate: { duration: s.dur * 1.2, delay, repeat: Infinity, repeatType: "mirror", ease: "linear" },
              }}
            />
          );
        }
        return (
          <motion.span
            key={i}
            className={`${base} opacity-40`}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.w,
              height: s.h,
            }}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 0.35, 0.3, 0.38],
              x: [0, s.driftX * 0.6, s.driftX],
              y: [0, s.driftY * 0.5, s.driftY],
            }}
            transition={{
              opacity: { duration: 1.3, delay: delay + 0.02, ease: "easeOut" },
              x: { duration: s.dur * 0.9, delay, repeat: Infinity, repeatType: "mirror", ease: "linear" },
              y: { duration: s.dur, delay, repeat: Infinity, repeatType: "mirror", ease: "linear" },
            }}
          />
        );
      })}
    </div>
  );
}

type ScoreRingProps = { score: number; styleId: string };

function ScoreRing({ score, styleId }: ScoreRingProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const keyName = `roadmapScoreRing_${styleId}`;
  const endOffset = 100 - clamped;

  const css = `@keyframes ${keyName} {
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: ${endOffset}; }
}
.${keyName} {
  animation: ${keyName} 1.2s ease-out forwards;
}`;

  return (
    <>
      <style>{css}</style>
      <div className="flex items-center gap-4">
        <svg
          className="size-[4.5rem] shrink-0 -rotate-90 text-zinc-100"
          viewBox="0 0 44 44"
          aria-hidden
        >
          <circle
            cx="22"
            cy="22"
            r="17"
            pathLength={100}
            fill="none"
            className="text-zinc-800"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="100"
            strokeDashoffset="0"
          />
          <circle
            cx="22"
            cy="22"
            r="17"
            pathLength={100}
            fill="none"
            className={`text-[#E5FF47] ${keyName}`}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="100"
            strokeDashoffset="100"
          />
        </svg>
        <p className="text-left text-sm font-medium leading-snug text-zinc-300">
          AI-Native Ready Score:{" "}
          <span className="font-semibold tabular-nums text-zinc-100">{clamped}%</span>
        </p>
      </div>
    </>
  );
}

export type StepRoadmapReadyProps = {
  content: RoadmapContent;
  /** Display label for the target role, e.g. &quot;Product Manager&quot; */
  roleLabel: string;
  /** Public username for profile URL; omit path segment when null */
  username: string | null;
};

export function StepRoadmapReady({
  content,
  roleLabel,
  username,
}: StepRoadmapReadyProps) {
  const styleId = useId().replace(/:/g, "");
  const score = content.meta.aiNativeReadyScore;
  const teasers = buildTeaserSlots(content);
  const actions = firstThreeActions(content);
  const profileUrl = buildCareerosProfileUrl(username);

  const shareText = `Just set up my AI ${roleLabel} roadmap on @Aihired. Starting my path to AI-native. 🚀 ${profileUrl}`;
  const linkedInUrl = buildLinkedInShareUrl(shareText);

  const openLinkedInShare = () => {
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative flex w-full max-w-lg flex-col gap-8">
      <CelebrationField />

      <motion.div
        className="relative z-10 flex flex-col gap-8"
        variants={STAGGER}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={STAGGER_ITEM}>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            Your roadmap is ready.
          </h1>
        </motion.div>

        <motion.div variants={STAGGER_ITEM} className="flex flex-col gap-3">
          {teasers.map((slot) => {
            const item = slot.item;
            return (
              <div
                key={slot.type}
                className="rounded-xl border border-zinc-800/90 bg-zinc-950/70 px-4 py-3 text-left shadow-sm backdrop-blur-sm"
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  {TYPE_LABEL[slot.type]}
                </p>
                {item ? (
                  <>
                    <p className="mt-1 text-sm font-semibold text-zinc-100">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                      {TeaserSubtitle(item)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">
                    More in your full roadmap inside Aihired.
                  </p>
                )}
              </div>
            );
          })}
        </motion.div>

        <motion.div variants={STAGGER_ITEM}>
          <ScoreRing score={score} styleId={styleId} />
        </motion.div>

        <motion.div variants={STAGGER_ITEM} className="text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Your 3 actions today:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-zinc-300">
            {actions.length > 0 ? (
              actions.map((item) => (
                <li key={item.id} className="pl-1 marker:text-zinc-600">
                  <span className="font-medium text-zinc-100">{item.title}</span>
                </li>
              ))
            ) : (
              <li className="pl-1 text-zinc-500">Open your roadmap to see next steps.</li>
            )}
          </ol>
        </motion.div>

        <motion.div variants={STAGGER_ITEM} className="flex flex-col gap-3">
          <Button
            type="button"
            asChild
            className="h-11 w-full bg-[#E5FF47] text-sm font-semibold text-[#111] hover:bg-[#d8f542]"
          >
            <Link href="/dashboard">Enter Aihired →</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
            onClick={openLinkedInShare}
          >
            Share on LinkedIn
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
