"use client";

import { useEffect } from "react";
import { MicIcon, MicOffIcon } from "lucide-react";

import { useMicCheck } from "@/hooks/use-mic-check";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MicCheckProps = {
  onReady: () => void;
  onSkip: () => void;
};

export function MicCheck({ onReady, onSkip }: MicCheckProps) {
  const { status, volumeLevel, startCheck, stopCheck } = useMicCheck();

  useEffect(() => {
    startCheck();
    return () => stopCheck();
  }, [startCheck, stopCheck]);

  const isChecking = status === "checking" || status === "idle";
  const isOk = status === "ok";
  const isDenied = status === "denied";
  const isError = status === "error";

  return (
    <div className="flex min-h-[min(70vh,520px)] items-center justify-center px-4">
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-white/8 bg-[#13131A] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
          isChecking && "ring-1 ring-[#6366F1]/30"
        )}
      >
        {isChecking && (
          <span
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              boxShadow: "0 0 0 0 rgba(99,102,241,0.35)",
              animation: "mic-check-pulse 2s ease-out infinite",
            }}
            aria-hidden
          />
        )}

        <style>{`
          @keyframes mic-check-pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.35);
            }
            70% {
              box-shadow: 0 0 0 14px rgba(99, 102, 241, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
            }
          }
        `}</style>

        <div className="flex flex-col items-center text-center">
          <div
            className={cn(
              "mb-6 flex size-16 items-center justify-center rounded-full border",
              isOk
                ? "border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]"
                : isDenied || isError
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-[#6366F1]/30 bg-[#6366F1]/10 text-[#6366F1]"
            )}
          >
            {isDenied || isError ? (
              <MicOffIcon className="size-7" />
            ) : (
              <MicIcon className="size-7" />
            )}
          </div>

          <h2 className="font-sans text-lg font-medium text-[#F8F8FF]">
            {isDenied
              ? "Microphone access blocked"
              : isError
                ? "Could not access microphone"
                : isOk
                  ? "You're all set"
                  : "Checking your microphone"}
          </h2>

          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#71717A]">
            {isDenied ? (
              <>
                Allow microphone access in your browser settings, then refresh
                this page. You can also continue in text mode.
              </>
            ) : isError ? (
              "We couldn't detect a working microphone. Try again or switch to text mode."
            ) : isOk ? (
              "We heard you clearly. Start when you're ready."
            ) : (
              "Say something — we'll confirm your mic is working before the interview begins."
            )}
          </p>

          <div className="mt-8 w-full">
            <div className="mb-2 flex items-center justify-between text-xs text-[#71717A]">
              <span>Input level</span>
              <span>{volumeLevel}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#0A0A0F]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-75",
                  isOk ? "bg-[#10B981]" : "bg-[#6366F1]"
                )}
                style={{ width: `${Math.max(4, volumeLevel)}%` }}
              />
            </div>
          </div>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
            {isDenied || isError ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-white/10 bg-transparent text-[#F8F8FF] hover:bg-white/5"
                  onClick={() => {
                    stopCheck();
                    startCheck();
                  }}
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-[#6366F1] text-white hover:bg-[#5558E3]"
                  onClick={onSkip}
                >
                  Switch to text mode
                </Button>
              </>
            ) : (
              <Button
                type="button"
                disabled={!isOk}
                className="w-full bg-[#6366F1] text-white hover:bg-[#5558E3] disabled:opacity-40"
                onClick={() => {
                  stopCheck();
                  onReady();
                }}
              >
                Mic is ready
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
