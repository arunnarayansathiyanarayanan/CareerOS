"use client";

import { useEffect, useRef } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import type { LiveTranscriptEntry } from "@/hooks/use-interview";
import { cn } from "@/lib/utils";

type LiveTranscriptProps = {
  entries: LiveTranscriptEntry[];
  isCollapsed: boolean;
  onToggle: () => void;
};

export function LiveTranscript({
  entries,
  isCollapsed,
  onToggle,
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCollapsed || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries, isCollapsed]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/8 bg-[#13131A]">
      <button
        type="button"
        onClick={onToggle}
        className="flex shrink-0 items-center justify-between gap-2 border-b border-white/6 px-4 py-3 text-left transition-colors hover:bg-white/[0.02] lg:pointer-events-none lg:cursor-default"
        aria-expanded={!isCollapsed}
      >
        <span className="font-sans text-sm font-medium text-[#F8F8FF]">
          Live transcript
        </span>
        <span className="flex items-center gap-1 text-xs text-[#71717A] lg:hidden">
          {isCollapsed ? "Show" : "Hide"}
          {isCollapsed ? (
            <ChevronDownIcon className="size-4" />
          ) : (
            <ChevronUpIcon className="size-4" />
          )}
        </span>
      </button>

      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-3 font-[family-name:var(--font-ibm-plex-mono)] text-sm transition-[max-height] duration-300",
          isCollapsed
            ? "max-h-0 overflow-hidden py-0 opacity-0 lg:max-h-none lg:overflow-y-auto lg:py-3 lg:opacity-100"
            : "max-h-[40vh] opacity-100 lg:max-h-none"
        )}
      >
        {entries.length === 0 ? (
          <p className="text-[#71717A]">Transcript will appear here…</p>
        ) : (
          <ul className="space-y-4">
            {entries.map((entry, index) => (
              <li
                key={`${entry.timestamp_ms}-${entry.role}-${index}`}
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-1 duration-300",
                  entry.role === "interviewer"
                    ? "text-left"
                    : "ml-6 text-right"
                )}
              >
                <span
                  className={cn(
                    "mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                    entry.role === "interviewer"
                      ? "bg-[#6366F1]/15 text-[#A5B4FC]"
                      : "bg-white/5 text-[#71717A]"
                  )}
                >
                  {entry.role === "interviewer" ? "Interviewer" : "You"}
                </span>
                <p
                  className={cn(
                    "leading-relaxed text-[#F8F8FF]/90",
                    entry.role === "candidate" && "text-[#F8F8FF]"
                  )}
                >
                  {entry.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
