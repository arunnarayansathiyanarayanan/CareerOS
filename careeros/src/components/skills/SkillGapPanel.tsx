"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/react";

function GapScoreRing({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const degrees = (clamped / 100) * 360;

  return (
    <div className="relative mx-auto size-36 shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#6366f1 ${degrees}deg, #27272a ${degrees}deg)`,
        }}
        aria-hidden
      />
      <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-[#0A0A0A]">
        <span className="font-mono text-3xl font-semibold tabular-nums text-zinc-50">
          {clamped}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          gap score
        </span>
      </div>
    </div>
  );
}

export function SkillGapPanel() {
  const utils = trpc.useUtils();
  const gapQuery = trpc.skillIntelligence.getMySkillGap.useQuery();
  const addMutation = trpc.skillIntelligence.addSkillToRoadmap.useMutation({
    onSuccess: () => {
      toast.success("Added to your roadmap");
      void utils.skillIntelligence.getMySkillGap.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Could not add to roadmap");
    },
  });
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleAdd = async (skillId: string) => {
    setAddingId(skillId);
    try {
      await addMutation.mutateAsync({ skillId });
    } finally {
      setAddingId(null);
    }
  };

  if (gapQuery.isLoading) {
    return (
      <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-5">
        <Skeleton className="mx-auto size-36 rounded-full" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (gapQuery.isError) {
    return (
      <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-5 text-sm text-zinc-400">
        <p>Could not load your skill gap analysis.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 border-zinc-700"
          onClick={() => void gapQuery.refetch()}
        >
          Retry
        </Button>
      </section>
    );
  }

  const data = gapQuery.data;
  if (!data) return null;

  return (
    <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/20 to-zinc-900/30 p-5 sm:p-6">
      <header className="mb-5">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
          Your skill gap
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Compared to top market demand for your role and city.
        </p>
      </header>

      <GapScoreRing score={data.gapScore} />

      <p className="mx-auto mt-4 max-w-xs text-center text-xs text-zinc-500">
        Higher score = more skills to close before you match market demand.
      </p>

      {data.rankedSkills.length === 0 ? (
        <p className="mt-6 text-center text-sm text-zinc-500">
          No priority gaps detected — you are well aligned.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {data.rankedSkills.map((skill) => (
            <li
              key={skill.skillId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {skill.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                    priority {skill.priority}
                  </span>
                  {skill.expectedSalaryLiftPct > 0 ? (
                    <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      +{skill.expectedSalaryLiftPct}% salary lift
                    </span>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800"
                disabled={addingId === skill.skillId || addMutation.isPending}
                onClick={() => void handleAdd(skill.skillId)}
              >
                {addingId === skill.skillId ?
                  <Loader2Icon className="size-4 animate-spin" />
                : "Add to Roadmap"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-center text-xs text-zinc-600">
        <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300">
          View full roadmap →
        </Link>
      </p>
    </section>
  );
}
