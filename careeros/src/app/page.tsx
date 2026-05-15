import { auth, currentUser } from "@clerk/nextjs/server";
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

  const user = await currentUser();
  const greetingName =
    user?.firstName?.trim() ||
    (user?.username ? String(user.username) : "there");

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <main className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          CareerOS
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back, {greetingName}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          You have finished onboarding. A fuller home experience can replace this
          screen when the product dashboard is ready.
        </p>
      </main>
    </div>
  );
}
