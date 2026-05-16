"use client";

import Link from "next/link";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { RubricScore } from "@/components/interview/RubricScore";
import { Button } from "@/components/ui/button";
import type { LiveTranscriptEntry } from "@/hooks/use-interview";
import type { FeedbackMoment, ParsedFeedback } from "@/lib/ai/feedback-ai";
import {
  activeMomentAtTime,
  activeTranscriptIndex,
  buildTranscriptTurnStarts,
  estimateTranscriptMs,
  entryMomentVariant,
  findAudioTurnAtTranscriptMs,
  formatDurationSeconds,
  formatReplayTimestamp,
  loadAudioDuration,
  orderedAudioTurns,
  type ActiveMoment,
} from "@/lib/interviews/replay";
import type { TranscriptEntry } from "@/lib/interviews/types";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
type PlaybackSpeed = (typeof SPEEDS)[number];

export type ReplayPlayerProps = {
  transcript: LiveTranscriptEntry[];
  sessionAudioUrls: Record<number, string>;
  feedback: ParsedFeedback;
  sessionId: string;
};

function globalPositionForTurn(
  turn: number,
  offsetInTurn: number,
  orderedTurns: number[],
  turnDurations: Map<number, number>
): number {
  let acc = 0;
  for (const t of orderedTurns) {
    if (t === turn) return acc + offsetInTurn;
    acc += turnDurations.get(t) ?? 0;
  }
  return acc;
}

function seekTurnFromGlobalPosition(
  targetSeconds: number,
  orderedTurns: number[],
  turnDurations: Map<number, number>
): { turn: number; offsetInTurn: number } | null {
  let acc = 0;
  for (const t of orderedTurns) {
    const d = turnDurations.get(t) ?? 0;
    if (d <= 0) continue;
    if (targetSeconds <= acc + d) {
      return { turn: t, offsetInTurn: Math.max(0, targetSeconds - acc) };
    }
    acc += d;
  }
  if (orderedTurns.length === 0) return null;
  const last = orderedTurns[orderedTurns.length - 1]!;
  return { turn: last, offsetInTurn: turnDurations.get(last) ?? 0 };
}

function transcriptEntriesForTurnStarts(
  transcript: LiveTranscriptEntry[],
  sessionAudioUrls: Record<number, string>
): TranscriptEntry[] {
  const urlToTurn = new Map<string, number>();
  for (const [turn, url] of Object.entries(sessionAudioUrls)) {
    urlToTurn.set(url, Number(turn));
  }
  return transcript.map((entry) => ({
    role: entry.role,
    content: entry.content,
    timestamp_ms: entry.timestamp_ms,
    turn_number:
      entry.audioUrl != null ? urlToTurn.get(entry.audioUrl) : undefined,
  }));
}

function CurrentMomentCallout({
  activeMoment,
  feedback,
}: {
  activeMoment: ActiveMoment;
  feedback: ParsedFeedback;
}) {
  if (!activeMoment) {
    return (
      <div className="rounded-xl border border-white/8 bg-[#13131A] p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Current moment
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Play or scrub the timeline to highlight feedback moments.
        </p>
      </div>
    );
  }

  const moment =
    activeMoment.kind === "strong"
      ? feedback.strong_moments[activeMoment.index]
      : feedback.improvement_moments[activeMoment.index];

  if (!moment) return null;

  const isStrong = activeMoment.kind === "strong";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isStrong
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-amber-500/40 bg-amber-500/10"
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          isStrong ? "text-emerald-400" : "text-amber-400"
        )}
      >
        {isStrong ? "Strong moment" : "Improvement moment"}
      </p>
      <p className="mt-2 font-mono text-sm text-zinc-200">
        &ldquo;{moment.quote_snippet}&rdquo;
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
        {moment.reason}
      </p>
    </div>
  );
}

function MomentHighlight({
  variant,
  moment,
  active,
  onSeek,
}: {
  variant: "strong" | "improvement";
  moment: FeedbackMoment;
  active: boolean;
  onSeek: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSeek}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        variant === "strong"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5",
        active &&
          (variant === "strong"
            ? "ring-2 ring-emerald-500/60"
            : "ring-2 ring-amber-500/60")
      )}
    >
      <p className="text-xs tabular-nums text-zinc-500">
        {formatReplayTimestamp(moment.timestamp_ms)}
      </p>
      <p className="mt-1 font-mono text-xs text-zinc-300">
        &ldquo;{moment.quote_snippet}&rdquo;
      </p>
      <p className="mt-2 text-sm text-zinc-400">{moment.reason}</p>
    </button>
  );
}

function FeedbackPanelContent({
  feedback,
  activeMoment,
  seekToTranscriptMs,
}: {
  feedback: ParsedFeedback;
  activeMoment: ActiveMoment;
  seekToTranscriptMs: (ms: number) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CurrentMomentCallout activeMoment={activeMoment} feedback={feedback} />

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">Rubric scores</h2>
        <div className="flex flex-col gap-4">
          {(
            [
              ["Structure", feedback.rubric_scores.structure],
              ["Clarity", feedback.rubric_scores.clarity],
              ["AI Depth", feedback.rubric_scores.ai_depth],
              ["Tradeoffs", feedback.rubric_scores.tradeoffs],
              ["Communication", feedback.rubric_scores.communication],
            ] as const
          ).map(([label, score]) => (
            <RubricScore key={label} label={label} score={score} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-emerald-400/90">
          Strong moments
        </h2>
        {feedback.strong_moments.map((moment, i) => (
          <MomentHighlight
            key={`strong-${i}`}
            variant="strong"
            moment={moment}
            active={
              activeMoment?.kind === "strong" && activeMoment.index === i
            }
            onSeek={() => seekToTranscriptMs(moment.timestamp_ms)}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-amber-400/90">
          Improvement moments
        </h2>
        {feedback.improvement_moments.map((moment, i) => (
          <MomentHighlight
            key={`improve-${i}`}
            variant="improvement"
            moment={moment}
            active={
              activeMoment?.kind === "improvement" &&
              activeMoment.index === i
            }
            onSeek={() => seekToTranscriptMs(moment.timestamp_ms)}
          />
        ))}
      </section>
    </div>
  );
}

export function ReplayPlayer({
  transcript,
  sessionAudioUrls,
  feedback,
  sessionId,
}: ReplayPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const currentTurnRef = useRef(0);
  const isPlayingRef = useRef(false);

  const orderedTurns = useMemo(
    () => orderedAudioTurns(sessionAudioUrls),
    [sessionAudioUrls]
  );
  const transcriptTurnStarts = useMemo(
    () =>
      buildTranscriptTurnStarts(
        transcriptEntriesForTurnStarts(transcript, sessionAudioUrls)
      ),
    [transcript, sessionAudioUrls]
  );

  const [turnDurations, setTurnDurations] = useState<Map<number, number>>(
    () => new Map()
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [globalSeconds, setGlobalSeconds] = useState(0);
  const [activeEntryIndex, setActiveEntryIndex] = useState(0);
  const [feedbackDrawerOpen, setFeedbackDrawerOpen] = useState(false);

  const totalDuration = useMemo(() => {
    let sum = 0;
    for (const t of orderedTurns) {
      sum += turnDurations.get(t) ?? 0;
    }
    return sum;
  }, [orderedTurns, turnDurations]);

  const currentTranscriptMs = useMemo(() => {
    const audio = audioRef.current;
    const turn = currentTurnRef.current;
    const offset = audio?.currentTime ?? 0;
    return estimateTranscriptMs(turn, offset, transcriptTurnStarts);
  }, [globalSeconds, transcriptTurnStarts]);

  const activeMoment = useMemo(
    () =>
      activeMomentAtTime(
        currentTranscriptMs,
        feedback.strong_moments,
        feedback.improvement_moments
      ),
    [currentTranscriptMs, feedback.strong_moments, feedback.improvement_moments]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Map<number, number>();
      await Promise.all(
        orderedTurns.map(async (turn) => {
          const url = sessionAudioUrls[turn];
          if (!url) return;
          const duration = await loadAudioDuration(url);
          if (duration > 0) next.set(turn, duration);
        })
      );
      if (!cancelled) setTurnDurations(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderedTurns, sessionAudioUrls]);

  const syncPlaybackState = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const turn = currentTurnRef.current;
    const global = globalPositionForTurn(
      turn,
      audio.currentTime,
      orderedTurns,
      turnDurations
    );
    setGlobalSeconds(global);
    const ms = estimateTranscriptMs(
      turn,
      audio.currentTime,
      transcriptTurnStarts
    );
    setActiveEntryIndex(activeTranscriptIndex(transcript, ms));
  }, [orderedTurns, turnDurations, transcriptTurnStarts, transcript]);

  const advanceFrom = useCallback((nextTurn: number) => {
    if (!isPlayingRef.current) return;
    playTurnRef.current(nextTurn, 0, true);
  }, []);

  const playTurnRef = useRef<
    (startTurn: number, offsetInTurn: number, autoplay: boolean) => void
  >(() => {});

  playTurnRef.current = (
    startTurn: number,
    offsetInTurn = 0,
    autoplay = false
  ) => {
    const audio = audioRef.current;
    if (!audio) return;

    const maxTurn = orderedTurns[orderedTurns.length - 1] ?? 0;
    let turn = startTurn;
    while (turn <= maxTurn) {
      const url = sessionAudioUrls[turn];
      if (url) {
        currentTurnRef.current = turn;
        audio.playbackRate = speed;

        const applyPosition = () => {
          audio.currentTime = offsetInTurn;
          if (autoplay) {
            void audio.play().catch(() => advanceFrom(turn + 1));
          } else {
            syncPlaybackState();
          }
        };

        if (audio.src !== url) {
          audio.src = url;
          audio.onloadedmetadata = applyPosition;
        } else {
          applyPosition();
        }
        return;
      }
      turn += 1;
    }
    if (autoplay) {
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  };

  const playTurn = useCallback(
    (startTurn: number, offsetInTurn = 0, autoplay = false) => {
      playTurnRef.current(startTurn, offsetInTurn, autoplay);
    },
    []
  );

  const seekToGlobal = useCallback(
    (targetSeconds: number) => {
      const found = seekTurnFromGlobalPosition(
        targetSeconds,
        orderedTurns,
        turnDurations
      );
      if (!found) return;
      currentTurnRef.current = found.turn;
      playTurn(found.turn, found.offsetInTurn, isPlayingRef.current);
    },
    [orderedTurns, turnDurations, playTurn, syncPlaybackState]
  );

  const seekToTranscriptMs = useCallback(
    (ms: number) => {
      const turn = findAudioTurnAtTranscriptMs(
        ms,
        orderedTurns,
        transcriptTurnStarts
      );
      const turnStartMs = transcriptTurnStarts.get(turn) ?? 0;
      const offsetInTurn = Math.max(0, (ms - turnStartMs) / 1000);
      const global = globalPositionForTurn(
        turn,
        offsetInTurn,
        orderedTurns,
        turnDurations
      );
      seekToGlobal(global);
    },
    [orderedTurns, transcriptTurnStarts, turnDurations, seekToGlobal]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || orderedTurns.length === 0) return;

    if (isPlayingRef.current) {
      audio.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    if (!audio.src || audio.ended) {
      playTurn(orderedTurns[0] ?? 0, 0, true);
    } else {
      audio.playbackRate = speed;
      void audio.play();
    }
  }, [orderedTurns, playTurn, speed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => syncPlaybackState();
    const onEnded = () => advanceFrom(currentTurnRef.current + 1);
    const onError = () => advanceFrom(currentTurnRef.current + 1);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [syncPlaybackState, advanceFrom]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const el = transcriptRefs.current.get(activeEntryIndex);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeEntryIndex]);

  const seekPercent =
    totalDuration > 0 ? (globalSeconds / totalDuration) * 100 : 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#0A0A0F] font-sans text-[#F8F8FF]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold text-[#F8F8FF]">
            Interview replay
          </h1>
          <p className="text-xs text-zinc-500">
            Overall {feedback.overall_score.toFixed(1)} / 10
          </p>
        </div>
        <Link
          href={`/interview/${sessionId}/feedback`}
          className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          ← Back to feedback
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 flex-[1.85] flex-col border-b border-white/8 lg:border-b-0 lg:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <ul className="space-y-3">
              {transcript.map((entry, index) => {
                const isActive = index === activeEntryIndex;
                const momentVariant = entryMomentVariant(
                  entry.timestamp_ms,
                  feedback.strong_moments,
                  feedback.improvement_moments
                );
                const isStrong = momentVariant === "strong";
                const isImprovement = momentVariant === "improvement";

                return (
                  <li
                    key={`${entry.timestamp_ms}-${entry.role}-${index}`}
                    ref={(el) => {
                      if (el) transcriptRefs.current.set(index, el);
                      else transcriptRefs.current.delete(index);
                    }}
                    className={cn(
                      "rounded-lg border px-4 py-3 transition-colors",
                      entry.role === "interviewer"
                        ? "border-white/6 bg-[#13131A]"
                        : "ml-0 border-white/6 bg-[#13131A]/80 sm:ml-8",
                      isActive && "border-indigo-500 ring-1 ring-indigo-500/50",
                      isStrong && !isActive && "border-l-4 border-l-emerald-500",
                      isImprovement &&
                        !isActive &&
                        !isStrong &&
                        "border-l-4 border-l-amber-500"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                          entry.role === "interviewer"
                            ? "bg-[#6366F1]/15 text-[#A5B4FC]"
                            : "bg-white/5 text-[#71717A]"
                        )}
                      >
                        {entry.role === "interviewer" ? "Interviewer" : "You"}
                      </span>
                      <button
                        type="button"
                        onClick={() => seekToTranscriptMs(entry.timestamp_ms)}
                        className={cn(
                          "shrink-0 font-mono text-xs tabular-nums transition-colors hover:text-indigo-300",
                          isStrong && "text-emerald-400",
                          isImprovement && !isStrong && "text-amber-400",
                          !isStrong && !isImprovement && "text-zinc-500"
                        )}
                      >
                        {formatReplayTimestamp(entry.timestamp_ms)}
                      </button>
                    </div>
                    <p className="mt-2 font-[family-name:var(--font-ibm-plex-mono)] text-sm leading-relaxed text-[#F8F8FF]/90">
                      {entry.content}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="hidden min-h-0 w-full flex-[1] flex-col overflow-hidden lg:flex">
          <div className="sticky top-0 max-h-[calc(100vh-4rem-5.5rem)] overflow-y-auto p-6">
            <FeedbackPanelContent
              feedback={feedback}
              activeMoment={activeMoment}
              seekToTranscriptMs={seekToTranscriptMs}
            />
          </div>
        </section>
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setFeedbackDrawerOpen((o) => !o)}
          className="flex w-full items-center justify-between border-t border-white/8 bg-[#13131A] px-4 py-3 text-sm font-medium text-zinc-200"
        >
          Feedback & rubric
          {feedbackDrawerOpen ? (
            <ChevronDownIcon className="size-4" />
          ) : (
            <ChevronUpIcon className="size-4" />
          )}
        </button>
        <div
          className={cn(
            "overflow-hidden border-t border-white/8 bg-[#0A0A0F] transition-[max-height] duration-300",
            feedbackDrawerOpen ? "max-h-[70vh] overflow-y-auto" : "max-h-0"
          )}
        >
          <div className="space-y-6 p-4">
            <FeedbackPanelContent
              feedback={feedback}
              activeMoment={activeMoment}
              seekToTranscriptMs={seekToTranscriptMs}
            />
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 z-20 shrink-0 border-t border-white/8 bg-[#13131A]/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <audio ref={audioRef} preload="metadata" className="hidden" />

        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={togglePlay}
              disabled={orderedTurns.length === 0}
              className="size-10 shrink-0 border-zinc-700 bg-zinc-900"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseIcon className="size-4" />
              ) : (
                <PlayIcon className="size-4" />
              )}
            </Button>

            <input
              type="range"
              min={0}
              max={totalDuration || 1}
              step={0.1}
              value={globalSeconds}
              disabled={totalDuration <= 0}
              onChange={(e) => seekToGlobal(Number(e.target.value))}
              className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-indigo-500 disabled:opacity-40"
              style={{
                background: `linear-gradient(to right, #6366f1 ${seekPercent}%, #27272a ${seekPercent}%)`,
              }}
            />

            <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400">
              {formatDurationSeconds(globalSeconds)} /{" "}
              {formatDurationSeconds(totalDuration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Speed</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  speed === s
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}


