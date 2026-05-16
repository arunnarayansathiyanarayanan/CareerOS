"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { FeedbackResponse } from "@/lib/interviews/types";

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10;

type FeedbackPendingPollerProps = {
  sessionId: string;
};

export function FeedbackPendingPoller({ sessionId }: FeedbackPendingPollerProps) {
  const router = useRouter();
  const attemptsRef = useRef(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (timedOut) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled) return;

      attemptsRef.current += 1;

      try {
        const res = await fetch(`/api/interviews/${sessionId}/feedback`);
        if (!res.ok) {
          throw new Error("poll failed");
        }

        const body = (await res.json()) as FeedbackResponse;
        if ("feedback" in body && body.feedback) {
          router.refresh();
          return;
        }
      } catch {
        // continue polling until max attempts
      }

      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setTimedOut(true);
        return;
      }

      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sessionId, router, timedOut]);

  if (timedOut) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0A0A0F] px-4 font-sans text-[#F8F8FF]">
        <p className="max-w-md text-center text-sm text-zinc-400">
          Taking longer than expected — check back in a minute.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 bg-[#0A0A0F] px-4 font-sans text-[#F8F8FF]">
      <Loader2Icon className="size-8 animate-spin text-[#E5FF47]" aria-hidden />
      <p className="text-center text-sm text-zinc-400">
        Generating your feedback report…
      </p>
    </main>
  );
}
