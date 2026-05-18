import { auth } from "@clerk/nextjs/server";

import { SkillsPageClient } from "@/components/skills/SkillsPageClient";

export default async function SkillsPage() {
  const { userId } = await auth();

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <SkillsPageClient isSignedIn={Boolean(userId)} />
      </div>
    </main>
  );
}
