import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { projectPublicPath } from "@/lib/projectsUrls";
import type { ProfilePinnedProjectDTO } from "@/server/routers/profile";

export function PinnedProjects({
  projects,
}: {
  projects: ProfilePinnedProjectDTO[];
}) {
  if (projects.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 px-4 py-8 text-center text-sm text-zinc-500">
        No pinned projects yet.
      </p>
    );
  }

  return (
    <ul className="grid min-h-[200px] gap-4 sm:grid-cols-2">
      {projects.map((p) => {
        const href = projectPublicPath(p.username, p.slug);
        const thumbSrc = `/api/og/project?${new URLSearchParams({
          username: p.username,
          slug: p.slug,
        })}`;
        const stack = p.aiStack.slice(0, 6);

        return (
          <li key={p.id}>
            <Link
              href={href}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/35 transition-colors hover:border-zinc-600 hover:bg-zinc-900/55"
            >
              <div className="relative aspect-[1200/630] w-full overflow-hidden bg-zinc-950">
                <Image
                  src={thumbSrc}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
                />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <h3 className="font-semibold text-white group-hover:text-indigo-200">
                    {p.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                    {p.oneLiner}
                  </p>
                </div>
                {stack.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {stack.map((s) => (
                      <Badge
                        key={s}
                        variant="secondary"
                        className="border border-zinc-700 bg-zinc-900/80 text-xs font-normal text-zinc-200"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <p className="mt-auto pt-1 text-xs tabular-nums text-zinc-500">
                  {p.viewCount.toLocaleString()} views
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
