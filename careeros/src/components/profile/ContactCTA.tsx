import Link from "next/link";

import { Button } from "@/components/ui/button";
import { projectPublicPath } from "@/lib/projectsUrls";
import type { ProfilePinnedProjectDTO } from "@/server/routers/profile";

export function ContactCTA({
  viewerIsOwner,
  pinned,
}: {
  viewerIsOwner: boolean;
  pinned: ProfilePinnedProjectDTO[];
}) {
  const first = pinned[0];

  if (viewerIsOwner) {
    return (
      <section className="rounded-2xl border border-indigo-500/20 bg-indigo-950/25 px-5 py-6 md:px-7 md:py-7">
        <p className="text-sm font-medium text-indigo-100">
          You&apos;re viewing your public profile
        </p>
        <p className="mt-2 max-w-xl text-sm text-indigo-200/80">
          Recruiters see this page exactly as visitors do. Tweak your headline,
          pins, and skills from the dashboard.
        </p>
        <Button asChild className="mt-5 bg-white text-indigo-950 hover:bg-zinc-100">
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-6 md:px-7 md:py-7">
      <p className="text-sm font-medium text-zinc-200">
        Explore their proof of work
      </p>
      <p className="mt-2 max-w-xl text-sm text-zinc-400">
        {first
          ? "Open a pinned project for outcomes, stack, and artifacts."
          : "More projects will appear here as they publish to Aihired."}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {first ? (
          <Button asChild>
            <Link href={projectPublicPath(first.username, first.slug)}>
              View featured project
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary" className="border border-zinc-700">
          <Link href="/">Build your portfolio</Link>
        </Button>
      </div>
    </section>
  );
}
