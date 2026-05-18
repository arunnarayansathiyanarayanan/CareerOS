import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LeaderboardWidget } from "@/components/community/LeaderboardWidget";
import { LeaveCohortButton } from "@/components/community/LeaveCohortButton";
import { Badge } from "@/components/ui/badge";
import { getClerkAppSession } from "@/lib/auth";
import { getOnboardingCompleteForClerk } from "@/lib/getOnboardingCompleteForClerk";
import { cn } from "@/lib/utils";
import { createCaller } from "@/server/caller";
import { createTRPCContext } from "@/server/trpc";

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function CohortPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    redirect("/sign-in");
  }

  const onboardingComplete = await getOnboardingCompleteForClerk(clerkUserId);
  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  const session = await getClerkAppSession();
  if (session.status !== "authenticated") {
    redirect("/sign-in");
  }

  const appUserId = session.appUser.id;
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);

  let cohortData: Awaited<ReturnType<typeof caller.community.cohort.getUser>>;

  try {
    cohortData = await caller.community.cohort.getUser();
  } catch {
    redirect("/onboarding");
  }

  const { cohort, memberCount, members } = cohortData;
  const displayMembers = members.slice(0, 80);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6">
      <div className="mb-8">
        <Link
          href="/community"
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Community
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            {cohort.name}
          </h1>
          <Badge variant="secondary">{memberCount} members</Badge>
          <LeaveCohortButton />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Members</h2>
          <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
            {displayMembers.map((member) => (
              <Link
                key={member.userId}
                href={`/u/${encodeURIComponent(member.username)}`}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors",
                  "hover:bg-zinc-900/80",
                )}
              >
                {member.imageUrl ? (
                  <Image
                    src={member.imageUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex size-10 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300"
                    aria-hidden
                  >
                    {memberInitials(member.displayName)}
                  </div>
                )}
                <span className="max-w-full truncate text-center text-xs text-zinc-400 group-hover:text-zinc-200">
                  {member.displayName}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <LeaderboardWidget cohortId={cohort.id} currentUserId={appUserId} />
        </aside>
      </div>
    </main>
  );
}
