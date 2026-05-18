import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ResumeOptimizerShell } from "@/components/resume/ResumeOptimizerShell";
import { getOnboardingCompleteForClerk } from "@/lib/getOnboardingCompleteForClerk";

export default async function ResumeOptimizerPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const onboardingComplete = await getOnboardingCompleteForClerk(userId);
  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-12">
      <ResumeOptimizerShell />
    </main>
  );
}
