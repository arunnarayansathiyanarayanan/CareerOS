import type { Metadata } from "next";
import Link from "next/link";
import {
  forbidden,
  notFound,
  redirect,
  unauthorized,
} from "next/navigation";

import {
  PublicProjectEmbeds,
  type PublicEmbedVm,
} from "@/components/projects/PublicProjectEmbeds";
import { Badge } from "@/components/ui/badge";
import {
  loadPublicProjectEmbeds,
  resolvePublicProjectAccess,
} from "@/lib/publicProjectPage";
import { toEmbedJson } from "@/lib/projectsApiShared";
import { getCareerosPublicHost, recruiterSharePath } from "@/lib/projectsUrls";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ username: string; slug: string }>;
};

async function requireRenderableProject(username: string, slug: string) {
  const access = await resolvePublicProjectAccess(username, slug);
  if (access.status === "not_found") notFound();
  if (access.status === "unauthorized") unauthorized();
  if (access.status === "forbidden") forbidden();
  if (access.status === "redirect_recruiter") {
    redirect(recruiterSharePath(access.token));
  }
  return access.project;
}

function formatPublishedRelative(date: Date): string {
  const ms = Date.now() - date.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr} yr ago`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const project = await requireRenderableProject(username, slug);
  const q = `username=${encodeURIComponent(username)}&slug=${encodeURIComponent(slug)}`;

  return {
    title: `${project.title} by ${username} | Aihired`,
    description: project.oneLiner,
    openGraph: {
      images: [
        {
          url: `/api/og/project?${q}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function PublicProjectPage({ params }: PageProps) {
  const { username, slug } = await params;
  const project = await requireRenderableProject(username, slug);
  const embedRows = await loadPublicProjectEmbeds(project.id);
  const embeds: PublicEmbedVm[] = embedRows.map((row) => {
    const j = toEmbedJson(row);
    return {
      id: j.id,
      type: j.type as PublicEmbedVm["type"],
      url: j.url,
    };
  });

  const publishedDate = project.publishedAt ?? project.createdAt;
  const marketingBase = `https://${getCareerosPublicHost()}`;

  const showAiReview =
    project.aiReviewerData?.portfolio_ready === true &&
    project.aiReviewerScore != null;

  const strengthPreview = (project.aiReviewerData?.strengths ?? []).slice(
    0,
    3
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-3xl px-4 pb-36 pt-10 sm:px-6 md:pb-28 md:pt-14">
        <header className="space-y-5 border-b border-zinc-800 pb-10">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-zinc-600 bg-zinc-900/80 font-normal text-zinc-300"
            >
              @{username}
            </Badge>
            <span className="text-xs text-zinc-500">
              Published {formatPublishedRelative(publishedDate)}
            </span>
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {project.title}
          </h1>
          <p className="text-lg text-zinc-400 md:text-xl">{project.oneLiner}</p>
          {project.aiStack.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {project.aiStack.map((skill) => (
                <Badge
                  key={skill}
                  variant="secondary"
                  className="border border-zinc-700 bg-zinc-900/90 font-normal text-zinc-200"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          ) : null}
          {project.autoTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Skills
              </span>
              {project.autoTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/skills/${encodeURIComponent(tag)}`}
                  className="inline-flex"
                >
                  <Badge
                    variant="outline"
                    className="border-indigo-800/60 bg-indigo-950/40 font-normal text-indigo-200 hover:border-indigo-600 hover:bg-indigo-950/70"
                  >
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : null}
        </header>

        <section className="mt-10 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Outcome
          </h2>
          <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/40 to-zinc-900/60 p-5 shadow-sm md:p-6">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-100 md:text-lg">
              {project.outcome}
            </p>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Problem solved
          </h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 md:p-6">
            <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">
              {project.problemSolved}
            </p>
          </div>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Embeds
          </h2>
          <PublicProjectEmbeds embeds={embeds} />
        </section>

        {showAiReview ? (
          <section className="mt-12 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              AI portfolio review
            </h2>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-3xl font-bold tracking-tight text-white">
                  {project.aiReviewerScore}
                  <span className="text-lg font-semibold text-zinc-500">/10</span>
                </span>
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  Portfolio-ready
                </Badge>
              </div>
              {strengthPreview.length > 0 ? (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                    Strengths
                  </p>
                  <ul className="list-inside list-disc space-y-1.5 text-sm text-zinc-300">
                    {strengthPreview.map((s, i) => (
                      <li key={`${i}-${s.slice(0, 64)}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mt-12 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-center text-sm text-zinc-400">
          Role:{" "}
          <span className="font-medium text-zinc-200">{project.myRole}</span>
        </section>
      </main>

      <aside className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur-md md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-center text-sm text-zinc-400 sm:text-left">
            Build your AI portfolio on Aihired — ship proof-of-work employers
            trust.
          </p>
          <Link
            href={`${marketingBase}/projects/new`}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            Build your AI portfolio → {getCareerosPublicHost()}
          </Link>
        </div>
      </aside>
    </div>
  );
}
