import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LeaderboardTable } from "@/components/community/LeaderboardTable";
import type { LeaderboardPageData } from "@/components/community/types";
import { getClerkAppSession } from "@/lib/auth";
import { getOnboardingCompleteForClerk } from "@/lib/getOnboardingCompleteForClerk";
import { createCaller } from "@/server/caller";
import * as cohortService from "@/server/services/cohort.service";
import { createTRPCContext } from "@/server/trpc";

export default async function CommunityLeaderboardPage() {
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
  let cohortId: string | undefined;

  try {
    const { cohort } = await cohortService.getUserCohort(appUserId);
    cohortId = cohort.id;
  } catch {
    cohortId = undefined;
  }

  const caller = createCaller(ctx);
  const rawData = cohortId
    ? await caller.community.leaderboard.getCohort({
        cohortId,
        limit: 50,
        offset: 0,
      })
    : await caller.community.leaderboard.getGlobal({
        limit: 50,
        offset: 0,
      });

  const initialData = JSON.parse(
    JSON.stringify(rawData),
  ) as LeaderboardPageData;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/community"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            ← Community
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ranked by projects shipped, interview growth, and community
            contribution.
          </p>
        </div>
      </div>

      <LeaderboardTable
        initialData={initialData}
        cohortId={cohortId}
        currentUserId={appUserId}
        defaultScope={cohortId ? "cohort" : "global"}
      />
    </main>
  );
}
