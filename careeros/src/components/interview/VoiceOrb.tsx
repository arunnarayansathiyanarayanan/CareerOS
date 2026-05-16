"use client";

import { cn } from "@/lib/utils";
import type { InterviewState } from "@/hooks/use-interview";

type VoiceOrbProps = {
  state: InterviewState;
  volumeLevel?: number;
};

export function VoiceOrb({ state, volumeLevel = 0 }: VoiceOrbProps) {
  const isListening = state === "listening";
  const isSpeaking = state === "speaking";
  const isProcessing = state === "processing";
  const isIdle =
    state === "idle" || state === "mic_check" || state === "starting";

  const scaleBoost = isListening
    ? 1 + Math.min(volumeLevel / 100, 1) * 0.08
    : 1;

  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes orb-breathe {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.06);
            opacity: 1;
          }
        }
        @keyframes orb-pulse-ring {
          0% {
            transform: scale(0.92);
            opacity: 0.7;
          }
          70% {
            transform: scale(1.35);
            opacity: 0;
          }
          100% {
            transform: scale(1.35);
            opacity: 0;
          }
        }
        @keyframes orb-wave {
          0% {
            transform: scale(1);
            opacity: 0.55;
          }
          100% {
            transform: scale(1.55);
            opacity: 0;
          }
        }
        @keyframes orb-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {isListening && (
        <span
          className="pointer-events-none absolute size-[120px] rounded-full border-2 border-[#6366F1]/60"
          style={{ animation: "orb-pulse-ring 2s ease-out infinite" }}
          aria-hidden
        />
      )}

      {isSpeaking && (
        <>
          <span
            className="pointer-events-none absolute size-[120px] rounded-full border border-[#10B981]/50"
            style={{ animation: "orb-wave 1.4s ease-out infinite" }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute size-[120px] rounded-full border border-[#10B981]/35"
            style={{
              animation: "orb-wave 1.4s ease-out infinite 0.45s",
            }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute size-[120px] rounded-full border border-[#10B981]/25"
            style={{
              animation: "orb-wave 1.4s ease-out infinite 0.9s",
            }}
            aria-hidden
          />
        </>
      )}

      {isProcessing && (
        <span
          className="pointer-events-none absolute size-[132px] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, #71717A 120deg, transparent 240deg)",
            animation: "orb-spin 1.1s linear infinite",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
          }}
          aria-hidden
        />
      )}

      <div
        className={cn(
          "relative size-[120px] rounded-full transition-colors duration-500",
          isListening &&
            "bg-gradient-to-br from-[#6366F1] to-[#4F46E5] shadow-[0_0_48px_rgba(99,102,241,0.45)]",
          isSpeaking &&
            "bg-gradient-to-br from-[#10B981] to-[#059669] shadow-[0_0_48px_rgba(16,185,129,0.4)]",
          isProcessing && "bg-[#1C1C26] shadow-[0_0_24px_rgba(113,113,122,0.2)]",
          isIdle && "bg-[#1A1A24] opacity-60 shadow-none"
        )}
        style={{
          transform: `scale(${scaleBoost})`,
          animation: isListening ? "orb-breathe 3s ease-in-out infinite" : undefined,
        }}
      >
        <span
          className={cn(
            "absolute inset-3 rounded-full",
            isListening && "bg-white/10",
            isSpeaking && "bg-white/15",
            isProcessing && "bg-white/5",
            isIdle && "bg-white/5"
          )}
        />
        <span
          className={cn(
            "absolute inset-0 rounded-full",
            isSpeaking &&
              "bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_55%)]"
          )}
        />
      </div>
    </div>
  );
}
