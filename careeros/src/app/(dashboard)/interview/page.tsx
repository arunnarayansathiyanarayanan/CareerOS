import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { InterviewSetupClient } from "./InterviewSetupClient";
import { getInterviewSetupForClerk } from "@/lib/getInterviewSetupForClerk";
import { FREE_TIER_WEEKLY_SESSION_LIMIT } from "@/lib/interviews/quota";
import { getOnboardingCompleteForClerk } from "@/lib/getOnboardingCompleteForClerk";

export default async function InterviewLobbyPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const onboardingComplete = await getOnboardingCompleteForClerk(userId);
  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  const setup = await getInterviewSetupForClerk(userId);
  if (!setup) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-zinc-400">
          Could not load interview setup. Check your connection and try again.
        </p>
      </main>
    );
  }

  return (
    <Suspense fallback={null}>
      <InterviewSetupClient
        isPro={setup.isPro}
        sessionsUsed={setup.quota.sessions_used}
        weeklyLimit={FREE_TIER_WEEKLY_SESSION_LIMIT}
        projects={setup.projects}
        readinessScores={setup.readinessScores}
      />
    </Suspense>
  );
}
