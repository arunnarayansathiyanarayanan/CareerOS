"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { TargetRole } from "@/types/roadmap";

export function DashboardEmptyState({ targetRole }: { targetRole: TargetRole }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/roadmap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof body === "object" && body && "error" in body
            ? String((body as { error?: string }).error)
            : "Could not generate roadmap";
        const code =
          typeof body === "object" && body && "code" in body
            ? String((body as { code?: string }).code)
            : "";
        throw new Error(code ? `${err} (${code})` : err);
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate roadmap");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-6 py-20 text-center">
      <p className="text-sm font-medium text-zinc-500">Aihired</p>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
        Your roadmap is almost ready
      </h1>
      <p className="text-sm leading-relaxed text-zinc-400">
        We could not load your roadmap yet. Generate it now from your onboarding
        profile, or contact support if this keeps happening.
      </p>
      <Button
        type="button"
        className="h-11 w-full bg-[#E5FF47] text-sm font-semibold text-[#111] hover:bg-[#d8f542]"
        disabled={loading}
        onClick={() => void handleGenerate()}
      >
        {loading ? "Building roadmap…" : "Generate my roadmap"}
      </Button>
    </div>
  );
}
