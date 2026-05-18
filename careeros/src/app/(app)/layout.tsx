import { auth } from "@clerk/nextjs/server";

import { AppHeader } from "@/components/dashboard/AppHeader";
import { getPublicProfileUsernameForClerk } from "@/lib/getPublicProfileForClerk";
import { createCaller } from "@/server/caller";
import { createTRPCContext } from "@/server/trpc";

export default async function AppGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();
  const profileUsername = userId
    ? await getPublicProfileUsernameForClerk(userId)
    : null;

  let currentStreak = 0;
  let longestStreak = 0;

  if (userId) {
    try {
      const ctx = await createTRPCContext();
      const caller = createCaller(ctx);
      const streak = await caller.community.streak.getMine();
      currentStreak = streak?.currentStreak ?? 0;
      longestStreak = streak?.longestStreak ?? 0;
    } catch {
      /* streak unavailable */
    }
  }

  return (
    <div className="dark min-h-full bg-[#0A0A0A] text-zinc-100">
      <AppHeader
        profileUsername={profileUsername}
        currentStreak={currentStreak}
        longestStreak={longestStreak}
      />
      {children}
    </div>
  );
}
