import { auth } from "@clerk/nextjs/server";

import { AppHeader } from "@/components/dashboard/AppHeader";
import { getPublicProfileUsernameForClerk } from "@/lib/getPublicProfileForClerk";

export default async function DashboardGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();
  const profileUsername = userId
    ? await getPublicProfileUsernameForClerk(userId)
    : null;

  return (
    <div className="dark min-h-full bg-[#0A0A0A] text-zinc-100">
      <AppHeader profileUsername={profileUsername} />
      {children}
    </div>
  );
}
