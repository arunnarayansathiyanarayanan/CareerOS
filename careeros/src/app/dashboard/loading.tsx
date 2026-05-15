import { Skeleton } from "@/components/ui/skeleton";

function PhaseSkeleton({ itemCount }: { itemCount: number }) {
  return (
    <div className="flex gap-4">
      <Skeleton className="mt-1 size-6 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48 max-w-[70%]" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-1 w-full rounded-full" />
        </div>
        <ul className="space-y-3">
          {Array.from({ length: itemCount }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-[4.25rem] w-full rounded-xl" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl animate-pulse flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56 max-w-[80%]" />
      </div>

      <Skeleton className="h-36 w-full rounded-2xl" />

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>

      <div className="space-y-10">
        <PhaseSkeleton itemCount={4} />
        <PhaseSkeleton itemCount={4} />
        <PhaseSkeleton itemCount={4} />
      </div>
    </div>
  );
}
