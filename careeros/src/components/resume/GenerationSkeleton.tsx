"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { GENERATION_STATUS_MESSAGES } from "@/components/resume/constants";

export function GenerationSkeleton() {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % GENERATION_STATUS_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4"
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-4 w-64 max-w-full bg-zinc-800" />
      <p className="text-center text-sm text-zinc-400">
        {GENERATION_STATUS_MESSAGES[statusIndex]}
      </p>
      <div className="grid w-full max-w-4xl gap-4 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl bg-zinc-800/80" />
        <Skeleton className="h-96 rounded-xl bg-zinc-800/80" />
      </div>
    </div>
  );
}
