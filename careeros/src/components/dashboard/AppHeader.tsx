"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLink =
  "text-sm text-zinc-400 transition-colors hover:text-zinc-100 data-[active=true]:text-zinc-100";

export function AppHeader({
  profileUsername = null,
}: {
  profileUsername?: string | null;
}) {
  const pathname = usePathname();
  const profilePath = profileUsername
    ? `/u/${encodeURIComponent(profileUsername)}`
    : null;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900/80 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-6 sm:gap-8">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight text-zinc-200 hover:text-white"
        >
          CareerOS
        </Link>
        <nav className="flex flex-wrap items-center gap-4 sm:gap-6" aria-label="Main">
          <Link
            href="/dashboard"
            className={navLink}
            data-active={pathname === "/dashboard" ? "true" : "false"}
          >
            Roadmap
          </Link>
          <Link
            href="/projects/new"
            className={navLink}
            data-active={pathname?.startsWith("/projects") ? "true" : "false"}
          >
            New project
          </Link>
          <Link
            href="/interview"
            className={navLink}
            data-active={pathname?.startsWith("/interview") ? "true" : "false"}
          >
            Interviews
          </Link>
          {profilePath ? (
            <Link
              href={profilePath}
              className={navLink}
              data-active={pathname?.startsWith("/u/") ? "true" : "false"}
            >
              Profile
            </Link>
          ) : null}
        </nav>
      </div>
      <UserButton afterSignOutUrl="/sign-in" />
    </header>
  );
}
