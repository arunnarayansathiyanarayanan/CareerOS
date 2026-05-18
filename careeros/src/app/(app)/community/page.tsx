import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
  ChallengeWidget,
  CommunityFeed,
  LeaderboardWidget,
} from "@/components/community";
import { StreakRing } from "@/components/streak/StreakRing";
import { getOnboardingCompleteForClerk } from "@/lib/getOnboardingCompleteForClerk";
import { getOnboardingTargetRoleForClerk } from "@/lib/getOnboardingTargetRoleForClerk";
import type { Cohort } from "@/server/db/schema/community.schema";
import * as cohortService from "@/server/services/cohort.service";
import * as streakService from "@/server/services/streak.service";

export default async function CommunityPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    redirect("/sign-in");
  }

  const onboardingComplete = await getOnboardingCompleteForClerk(clerkUserId);
  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  const { getClerkAppSession } = await import("@/lib/auth");
  const session = await getClerkAppSession();
  if (session.status !== "authenticated") {
    redirect("/sign-in");
  }

  const userId = session.appUser.id;

  const targetRole = await getOnboardingTargetRoleForClerk(clerkUserId);

  const [streakRow, recentEvents, cohortResult] = await Promise.all([
    streakService.getUserStreak(userId),
    streakService.getRecentStreakEvents(userId, 30),
    cohortService.ensureUserCohort(userId, targetRole).catch(() => null),
  ]);

  const cohort: Cohort | null = cohortResult?.cohort ?? null;
  const streak = {
    currentStreak: streakRow?.currentStreak ?? 0,
    longestStreak: streakRow?.longestStreak ?? 0,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Community
          </h1>
          {cohort ? (
            <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
              {cohort.name}
            </span>
          ) : null}
        </div>

        {!cohort ? (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <p className="text-sm text-zinc-400">
              We couldn&apos;t place you in a cohort yet. Refresh the page, or
              try again in a moment.
            </p>
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_380px]">
        <section className="min-w-0">
          <CommunityFeed cohortId={cohort?.id} currentUserId={userId} />
        </section>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <ChallengeWidget />

          <div className="mt-4">
            <StreakRing
              currentStreak={streak.currentStreak}
              longestStreak={streak.longestStreak}
              size="md"
              recentEvents={recentEvents}
            />
          </div>

          {cohort ? (
            <div className="mt-4">
              <LeaderboardWidget cohortId={cohort.id} currentUserId={userId} />
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
