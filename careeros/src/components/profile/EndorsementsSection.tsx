import { Badge } from "@/components/ui/badge";
import { createCaller } from "@/server/caller";
import { createTRPCContext } from "@/server/trpc";

export async function EndorsementsSection({
  username,
}: {
  username: string;
}) {
  const caller = createCaller(await createTRPCContext());
  const rows = await caller.profile.getEndorsements({ username });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Endorsements from peers will show up here.
      </p>
    );
  }

  return (
    <ul className="flex min-h-[160px] flex-wrap gap-2">
      {rows.map((r) => (
        <li key={r.skill}>
          <Badge
            variant="outline"
            className="border-zinc-600 bg-zinc-900/50 px-3 py-1.5 text-sm font-normal text-zinc-200"
          >
            <span>{r.skill}</span>
            <span className="ml-2 tabular-nums text-zinc-500">×{r.count}</span>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
