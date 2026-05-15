import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { getGroupedRoadmapForClerk } from "@/lib/getGroupedRoadmapForClerk";
import { getOnboardingCompleteForClerk } from "@/lib/getOnboardingCompleteForClerk";
import { getOnboardingTargetRoleForClerk } from "@/lib/getOnboardingTargetRoleForClerk";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const onboardingComplete = await getOnboardingCompleteForClerk(userId);
  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  const groupedRoadmap = await getGroupedRoadmapForClerk(userId);

  if (!groupedRoadmap) {
    const targetRole = await getOnboardingTargetRoleForClerk(userId);
    return <DashboardEmptyState targetRole={targetRole} />;
  }

  return <RoadmapTimeline groupedRoadmap={groupedRoadmap} />;
}
