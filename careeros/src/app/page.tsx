import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getOnboardingCompleteForClerk } from "@/lib/getOnboardingCompleteForClerk";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/onboarding");
  }

  const onboardingComplete = await getOnboardingCompleteForClerk(userId);
  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
