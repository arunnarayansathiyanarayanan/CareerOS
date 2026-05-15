import { cn } from "@/lib/utils";

export function SkillGraphSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-[320px] min-h-[320px] w-full animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40",
        className
      )}
      aria-hidden
    />
  );
}

export function EndorsementsSkeleton() {
  return (
    <div className="h-[160px] min-h-[160px] space-y-3">
      <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
      <div className="h-9 w-full animate-pulse rounded-lg bg-zinc-800/80" />
      <div className="h-9 w-full animate-pulse rounded-lg bg-zinc-800/80" />
      <div className="h-9 w-3/4 animate-pulse rounded-lg bg-zinc-800/80" />
    </div>
  );
}

export function ActivityTimelineSkeleton() {
  return (
    <div className="min-h-[200px] space-y-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-800" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800/80" />
          </div>
        </div>
      ))}
    </div>
  );
}
