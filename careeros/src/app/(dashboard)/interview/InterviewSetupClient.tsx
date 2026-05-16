"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ProjectPicker } from "@/components/interview/ProjectPicker";
import { TrackSelector } from "@/components/interview/TrackSelector";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  TRACK_FOR_SUB_MODE,
  validateSubMode,
  type SubMode,
  type Track,
} from "@/lib/ai/question-bank";
import type { InterviewSetupProject } from "@/lib/getInterviewSetupForClerk";
import type { ReadinessScore, StartInterviewResponse } from "@/lib/interviews/types";
import { cn } from "@/lib/utils";

const TRACK_LABELS: Record<Track, string> = {
  ai_pm: "AI PM",
  ai_generalist: "AI Generalist",
};

export type InterviewSetupClientProps = {
  isPro: boolean;
  sessionsUsed: number;
  weeklyLimit: number;
  projects: InterviewSetupProject[];
  readinessScores: ReadinessScore[];
};

export function InterviewSetupClient({
  isPro,
  sessionsUsed,
  weeklyLimit,
  projects,
  readinessScores,
}: InterviewSetupClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [selectedSubMode, setSelectedSubMode] = useState<SubMode | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const subModeParam = searchParams.get("subMode");
    if (!subModeParam) return;

    const track = TRACK_FOR_SUB_MODE[subModeParam as SubMode];
    if (!track || !validateSubMode(track, subModeParam)) return;

    setSelectedTrack(track);
    setSelectedSubMode(subModeParam as SubMode);
  }, [searchParams]);

  const atQuotaLimit = !isPro && sessionsUsed >= weeklyLimit;
  const canStart =
    selectedTrack != null &&
    selectedSubMode != null &&
    !atQuotaLimit &&
    !starting;

  const handleTrackChange = (track: Track) => {
    setSelectedTrack(track);
    if (selectedSubMode && TRACK_FOR_SUB_MODE[selectedSubMode] !== track) {
      setSelectedSubMode(null);
    }
  };

  const handleStart = async () => {
    if (!selectedTrack || !selectedSubMode || atQuotaLimit) return;

    setStarting(true);
    try {
      const res = await fetch("/api/interviews/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: selectedTrack,
          subMode: selectedSubMode,
          projectContextIds:
            selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
        }),
      });

      const body = (await res.json()) as StartInterviewResponse & {
        error?: string;
        resetAt?: string;
      };

      if (!res.ok) {
        const message =
          body.error === "weekly_limit_reached"
            ? "Weekly interview limit reached. Upgrade to Pro for unlimited sessions."
            : typeof body.error === "string"
              ? body.error
              : "Failed to start interview";
        toast.error(message);
        return;
      }

      router.push(`/interview/${body.sessionId}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          CareerOS
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          AI mock interview
        </h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Voice-first practice with an AI interviewer. Pick a track, link your
          projects, and get structured feedback when you finish.
        </p>
        <Link
          href="/interview/history"
          className="inline-block text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
        >
          View interview history →
        </Link>
      </header>

      <ReadinessScoreCard scores={readinessScores} />

      <div className="mt-8 space-y-8">
        <TrackSelector
          selectedTrack={selectedTrack}
          selectedSubMode={selectedSubMode}
          onTrackChange={handleTrackChange}
          onSubModeChange={setSelectedSubMode}
        />

        <ProjectPicker
          projects={projects}
          selected={selectedProjectIds}
          onChange={setSelectedProjectIds}
        />

        <section className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-4 sm:p-5">
          {!isPro ? (
            <p className="text-xs text-zinc-500">
              {sessionsUsed} of {weeklyLimit} interviews used this week
            </p>
          ) : (
            <p className="text-xs text-zinc-500">Pro — unlimited interviews</p>
          )}

          {atQuotaLimit ? (
            <p className="mt-2 text-sm text-zinc-400">
              You&apos;ve used your free interview for this week. Upgrade to Pro
              for unlimited mock interviews.
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              disabled={!canStart}
              onClick={() => void handleStart()}
              className={cn(
                "h-11 flex-1 bg-[#E5FF47] text-sm font-semibold text-[#111] hover:bg-[#d8f542]",
                (!canStart || starting) && "opacity-70"
              )}
            >
              {starting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Preparing your session…
                </>
              ) : (
                "Start interview"
              )}
            </Button>

            {atQuotaLimit ? (
              <Button
                type="button"
                variant="outline"
                asChild
                className="h-11 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                <Link href="mailto:support@careeros.app?subject=Upgrade%20to%20Pro">
                  Upgrade to Pro
                </Link>
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function ReadinessScoreCard({ scores }: { scores: ReadinessScore[] }) {
  const tracks: Track[] = ["ai_pm", "ai_generalist"];

  return (
    <section className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-4 sm:p-5">
      <h2 className="text-sm font-medium text-zinc-300">Readiness score</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Weighted average from your recent completed interviews, per track.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {tracks.map((track) => {
          const row = scores.find((item) => item.track === track);
          const hasSessions = row != null && row.session_count > 0;

          return (
            <div
              key={track}
              className="rounded-lg border border-zinc-800/80 bg-[#141414] p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {TRACK_LABELS[track]}
              </p>
              {hasSessions && row ? (
                <>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-50">
                    {Math.round(row.score)}
                    <span className="text-base font-normal text-zinc-500">
                      {" "}
                      / 100
                    </span>
                  </p>
                  <Progress
                    value={Math.min(100, Math.max(0, row.score))}
                    className="mt-3 h-1.5 bg-zinc-800 [&_[data-slot=progress-indicator]]:bg-[#E5FF47]"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    {row.session_count}{" "}
                    {row.session_count === 1 ? "session" : "sessions"} completed
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                  Complete your first interview to see your readiness score.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
