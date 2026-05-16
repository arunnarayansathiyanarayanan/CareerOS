"use client";

/**
 * E5 Interview Studio — manual QA checklist
 *
 * [ ] Mic check: volume bar animates; "Mic is ready" enters voice mode
 * [ ] Mic denied: permission copy + "Switch to text mode" submits without audio
 * [ ] Opening question audio plays on turn 1 (resume skips if already played)
 * [ ] Voice: record → stop → processing → interviewer speaks next question
 * [ ] Text fallback: type answer and submit without microphone
 * [ ] Pause ("I need a moment") halts recording timer until resumed
 * [ ] Top progress bar and "Turn N of M" stay in sync with API turn count
 * [ ] Live transcript collapses/expands; interviewer + candidate lines visible
 * [ ] Final turn → "Interview complete" → redirect to /interview/[id]/feedback
 * [ ] Error state: "Try again" and "Switch to text mode" recover the session
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PauseIcon, PlayIcon } from "lucide-react";

import { MicCheck } from "@/components/interview/MicCheck";
import { LiveTranscript } from "@/components/interview/LiveTranscript";
import { TextFallback } from "@/components/interview/TextFallback";
import { VoiceOrb } from "@/components/interview/VoiceOrb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInterview } from "@/hooks/use-interview";
import type { InterviewStudioInitialProps } from "@/lib/interviews/session-studio";
import { cn } from "@/lib/utils";

type InterviewStudioProps = InterviewStudioInitialProps;

export function InterviewStudio(initial: InterviewStudioProps) {
  const router = useRouter();
  const resumedRef = useRef(false);
  const [transcriptCollapsed, setTranscriptCollapsed] = useState(true);

  const {
    interviewState,
    mode,
    sessionId,
    currentQuestion,
    turnNumber,
    totalTurns,
    liveTranscript,
    isRecording,
    recordingDuration,
    textInput,
    errorMessage,
    isPaused,
    resumeSession,
    startRecording,
    stopRecordingAndSubmit,
    submitTextTurn,
    switchToTextMode,
    setTextInput,
    togglePause,
  } = useInterview();

  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    resumeSession({
      sessionId: initial.sessionId,
      mode: initial.mode,
      transcript: initial.transcript,
      currentQuestion: initial.currentQuestion,
      currentAudioUrl: initial.currentAudioUrl,
      turnNumber: initial.turnNumber,
      totalTurns: initial.totalTurns,
      initialState: initial.initialState,
      openingAlreadyPlayed: initial.openingAlreadyPlayed,
    });
  }, [initial, resumeSession]);

  useEffect(() => {
    if (interviewState === "completed" && sessionId) {
      const t = setTimeout(() => {
        router.push(`/interview/${sessionId}/feedback`);
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [interviewState, router, sessionId]);

  const progressPct =
    totalTurns > 0 ? Math.min(100, (turnNumber / totalTurns) * 100) : 0;

  const displaySeconds = recordingDuration;
  const isTextMode = mode === "text";
  const isSubmitting = interviewState === "processing";

  const orbState =
    interviewState === "mic_check" ? "mic_check" : interviewState;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#0A0A0F] font-sans text-[#F8F8FF]">
      <div
        className="absolute inset-x-0 top-0 h-0.5 bg-[#13131A]"
        role="progressbar"
        aria-valuenow={turnNumber}
        aria-valuemin={1}
        aria-valuemax={totalTurns}
      >
        <div
          className="h-full bg-[#6366F1] transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col px-4 pb-12 pt-6 lg:min-h-[calc(100vh-4rem)] lg:flex-row lg:gap-8 lg:px-6 lg:pt-8">
        <div className="flex min-w-0 flex-1 flex-col lg:w-[60%]">
          {interviewState !== "mic_check" &&
            interviewState !== "starting" &&
            interviewState !== "completed" &&
            interviewState !== "error" && (
              <div className="order-4 mb-4 flex items-center justify-between lg:order-first lg:mb-6">
                <span className="text-xs text-[#71717A]">
                  Turn {turnNumber} of {totalTurns}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={togglePause}
                  disabled={
                    interviewState === "processing" ||
                    interviewState === "speaking"
                  }
                  className="text-[#71717A] hover:bg-white/5 hover:text-[#F8F8FF]"
                >
                  {isPaused ? (
                    <>
                      <PlayIcon className="size-3.5" />
                      Resume
                    </>
                  ) : (
                    <>
                      <PauseIcon className="size-3.5" />
                      I need a moment
                    </>
                  )}
                </Button>
              </div>
            )}

          {(interviewState === "listening" ||
            interviewState === "speaking" ||
            interviewState === "processing") && (
            <p
              className={cn(
                "order-1 mb-6 text-center text-lg font-medium leading-snug text-[#F8F8FF] transition-opacity duration-500 lg:order-2 lg:mb-8 lg:text-2xl",
                interviewState === "speaking" && "animate-in fade-in duration-700"
              )}
            >
              {currentQuestion}
            </p>
          )}

          {interviewState === "mic_check" ? (
            <MicCheck
              onReady={() => startRecording()}
              onSkip={() => {
                switchToTextMode();
                startRecording();
              }}
            />
          ) : interviewState === "starting" ? (
            <StartingSkeleton />
          ) : interviewState === "completed" ? (
            <CompletedState />
          ) : interviewState === "error" ? (
            <ErrorState
              message={errorMessage}
              onRetry={() => startRecording()}
              onTextMode={() => {
                switchToTextMode();
                startRecording();
              }}
            />
          ) : (
            <>
              <div className="order-2 flex flex-col items-center py-6 lg:order-1 lg:py-10">
                <VoiceOrb state={orbState} />
              </div>

              <div className="order-3 flex flex-col items-center gap-4 lg:order-3">
                {interviewState === "listening" && !isTextMode && (
                  <>
                    <p className="text-sm text-[#71717A]">
                      {isPaused
                        ? "Paused"
                        : isRecording
                          ? `Recording… ${displaySeconds}s`
                          : "Listening…"}
                    </p>
                    {isRecording && !isPaused && (
                      <button
                        type="button"
                        onClick={() => void stopRecordingAndSubmit()}
                        className="group relative flex size-20 items-center justify-center rounded-full border-2 border-red-500/80 bg-red-500/10 transition-transform hover:scale-105 active:scale-95"
                        aria-label="Stop recording"
                      >
                        <span className="size-7 rounded-sm bg-red-500" />
                        <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-red-500/40 ring-offset-2 ring-offset-[#0A0A0F] transition-all group-hover:ring-red-500/70" />
                      </button>
                    )}
                    {isRecording && isPaused && (
                      <p className="text-xs text-[#71717A]">
                        Recording paused — resume when ready
                      </p>
                    )}
                  </>
                )}

                {interviewState === "processing" && (
                  <p className="flex items-center gap-2 text-sm text-[#71717A]">
                    <Loader2Icon className="size-4 animate-spin text-[#6366F1]" />
                    Processing your answer…
                  </p>
                )}

                {interviewState === "speaking" && (
                  <p className="text-sm text-[#10B981]">Interviewer speaking…</p>
                )}

                {interviewState === "listening" && isTextMode && (
                  <TextFallback
                    value={textInput}
                    onChange={setTextInput}
                    onSubmit={() => void submitTextTurn()}
                    isSubmitting={isSubmitting}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {interviewState !== "mic_check" &&
          interviewState !== "starting" &&
          interviewState !== "completed" && (
            <aside className="mt-6 flex min-h-0 flex-col lg:order-none lg:mt-0 lg:w-[40%] lg:max-h-[calc(100vh-6rem)]">
              <LiveTranscript
                entries={liveTranscript}
                isCollapsed={transcriptCollapsed}
                onToggle={() => setTranscriptCollapsed((v) => !v)}
              />
            </aside>
          )}
      </div>
    </div>
  );
}

function StartingSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-20">
      <Skeleton className="size-[120px] rounded-full bg-[#13131A]" />
      <div className="space-y-2 text-center">
        <Skeleton className="mx-auto h-4 w-48 bg-[#13131A]" />
        <p className="text-sm text-[#71717A]">Preparing your interview…</p>
      </div>
    </div>
  );
}

function CompletedState() {
  return (
    <div className="flex flex-1 animate-in fade-in flex-col items-center justify-center gap-4 py-20 duration-700">
      <Loader2Icon className="size-10 animate-spin text-[#6366F1]" />
      <p className="text-center text-lg text-[#F8F8FF]">
        Interview complete! Generating your feedback…
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  onTextMode,
}: {
  message: string | null;
  onRetry: () => void;
  onTextMode: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-6 py-16">
      <div className="w-full rounded-xl border border-red-500/20 bg-[#13131A] p-6 text-center">
        <h2 className="text-lg font-medium text-[#F8F8FF]">Something went wrong</h2>
        <p className="mt-2 text-sm text-[#71717A]">
          {message ?? "We couldn't continue this interview session."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="flex-1 bg-[#6366F1] text-white hover:bg-[#5558E3]"
            onClick={onRetry}
          >
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-white/10 bg-transparent text-[#F8F8FF]"
            onClick={onTextMode}
          >
            Switch to text mode
          </Button>
        </div>
      </div>
    </div>
  );
}
