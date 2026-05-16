"use client";

import { useCallback } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TextFallbackProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
};

const MAX_CHARS = 4000;

export function TextFallback({
  value,
  onChange,
  onSubmit,
  isSubmitting,
}: TextFallbackProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isSubmitting && value.trim().length > 0) {
          onSubmit();
        }
      }
    },
    [isSubmitting, onSubmit, value]
  );

  return (
    <div className="w-full max-w-xl">
      <div className="mb-4 rounded-lg border border-[#6366F1]/25 bg-[#6366F1]/10 px-4 py-2.5 text-center text-sm text-[#C7D2FE]">
        Switched to text mode — type your answer below.
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
        placeholder="Type your answer…"
        rows={4}
        className={cn(
          "min-h-[96px] resize-y border-white/10 bg-[#0A0A0F] font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[#F8F8FF] placeholder:text-[#71717A] focus-visible:border-[#6366F1]/50 focus-visible:ring-[#6366F1]/20"
        )}
      />

      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="text-xs text-[#71717A]">
          {value.length} / {MAX_CHARS} · Ctrl+Enter to submit
        </span>
        <Button
          type="button"
          disabled={isSubmitting || value.trim().length === 0}
          onClick={onSubmit}
          className="bg-[#6366F1] text-white hover:bg-[#5558E3] disabled:opacity-40"
        >
          {isSubmitting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit answer"
          )}
        </Button>
      </div>
    </div>
  );
}
