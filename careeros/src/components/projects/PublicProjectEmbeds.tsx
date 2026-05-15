"use client";

import {
  ExternalLinkIcon,
  FileTextIcon,
  GitBranchIcon,
  LinkIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  loomEmbedUrlFromShareUrl,
  parseGithubRepoUrl,
  youtubeEmbedUrlFromWatchUrl,
} from "@/lib/embedDisplay";
import { cn } from "@/lib/utils";

export type PublicEmbedVm = {
  id: string;
  type:
    | "github"
    | "loom"
    | "youtube"
    | "notion"
    | "deployed_url"
    | "screenshot"
    | "pdf";
  url: string | null;
};

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

type EmbedChunk =
  | { kind: "single"; item: PublicEmbedVm }
  | { kind: "screenshot_grid"; items: PublicEmbedVm[] };

function chunkEmbedsForLayout(embeds: PublicEmbedVm[]): EmbedChunk[] {
  const chunks: EmbedChunk[] = [];
  let shots: PublicEmbedVm[] = [];
  const flushShots = () => {
    if (shots.length === 0) return;
    chunks.push({ kind: "screenshot_grid", items: shots });
    shots = [];
  };

  for (const e of embeds) {
    if (!e.url?.trim()) continue;
    if (e.type === "screenshot") {
      shots.push(e);
      continue;
    }
    flushShots();
    chunks.push({ kind: "single", item: e });
  }
  flushShots();
  return chunks;
}

export function PublicProjectEmbeds({ embeds }: { embeds: PublicEmbedVm[] }) {
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!lightboxUrl) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  if (embeds.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
        No embeds yet.
      </p>
    );
  }

  const chunks = chunkEmbedsForLayout(embeds);

  if (chunks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
        No embeds yet.
      </p>
    );
  }

  function renderSingle(e: PublicEmbedVm) {
    const url = e.url!;
    if (e.type === "github") {
            const gh = parseGithubRepoUrl(url);
            if (!gh) {
              return (
                <a
                  key={e.id}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-indigo-300 hover:bg-zinc-900"
                >
                  <GitBranchIcon className="size-5 shrink-0" />
                  <span className="min-w-0 truncate">{url}</span>
                  <ExternalLinkIcon className="ml-auto size-4 shrink-0 opacity-60" />
                </a>
              );
            }
            return (
              <a
                key={e.id}
                href={gh.href}
                target="_blank"
                rel="noreferrer"
                className="group rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900 p-4 shadow-sm transition-colors hover:border-zinc-700"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800">
                    <GitBranchIcon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-100">
                      {gh.owner}/{gh.repo}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      GitHub repository
                    </p>
                  </div>
                  <ExternalLinkIcon className="size-4 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </a>
            );
    }

    if (e.type === "youtube") {
            const embed = youtubeEmbedUrlFromWatchUrl(url);
            if (!embed) {
              return (
                <a
                  key={e.id}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-300 hover:underline"
                >
                  Open video
                  <ExternalLinkIcon className="size-4" />
                </a>
              );
            }
            return (
              <div
                key={e.id}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-sm"
              >
                <div className="relative aspect-video w-full">
                  <iframe
                    title="YouTube embed"
                    src={embed}
                    className="absolute inset-0 h-full w-full"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            );
    }

    if (e.type === "loom") {
            const embed = loomEmbedUrlFromShareUrl(url);
            if (!embed) {
              return (
                <a
                  key={e.id}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-300 hover:underline"
                >
                  Open Loom
                  <ExternalLinkIcon className="size-4" />
                </a>
              );
            }
            return (
              <div
                key={e.id}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-sm"
              >
                <div className="relative aspect-video w-full">
                  <iframe
                    title="Loom embed"
                    src={embed}
                    className="absolute inset-0 h-full w-full"
                    loading="lazy"
                    allow="fullscreen"
                  />
                </div>
              </div>
            );
    }

    if (e.type === "notion") {
            return (
              <a
                key={e.id}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
                  <FileTextIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    Notion doc
                  </p>
                  <p className="truncate text-xs text-zinc-500">{hostLabel(url)}</p>
                </div>
                <ExternalLinkIcon className="size-4 shrink-0 text-zinc-500" />
              </a>
            );
    }

    if (e.type === "deployed_url") {
            return (
              <a
                key={e.id}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 transition-colors hover:border-emerald-800/50 hover:bg-emerald-950/35"
              >
                <LinkIcon className="size-5 shrink-0 text-emerald-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-emerald-100">
                  {hostLabel(url)}
                </span>
                <ExternalLinkIcon className="size-4 shrink-0 text-emerald-400/70" />
              </a>
            );
    }

    if (e.type === "screenshot") {
      return null;
    }

    if (e.type === "pdf") {
            return (
              <div
                key={e.id}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-200">
                    <FileTextIcon className="size-4 text-zinc-400" />
                    PDF
                  </div>
                  <Button variant="outline" size="sm" className="border-zinc-700" asChild>
                    <a href={url} download target="_blank" rel="noreferrer">
                      Download
                    </a>
                  </Button>
                </div>
                <iframe
                  title="PDF preview"
                  src={url}
                  loading="lazy"
                  className="min-h-[480px] w-full bg-zinc-950"
                />
              </div>
            );
    }

    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {chunks.map((chunk) => {
          if (chunk.kind === "screenshot_grid") {
            return (
              <div
                key={chunk.items.map((i) => i.id).join("-")}
                className="grid grid-cols-2 gap-3 md:grid-cols-3"
              >
                {chunk.items.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={cn(
                      "relative aspect-video overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 ring-offset-zinc-950 transition hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    )}
                    onClick={() => setLightboxUrl(e.url ?? null)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.url!}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            );
          }
          return <React.Fragment key={chunk.item.id}>{renderSingle(chunk.item)}</React.Fragment>;
        })}
      </div>

      {lightboxUrl ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800"
            aria-label="Close"
            onClick={(ev) => {
              ev.stopPropagation();
              setLightboxUrl(null);
            }}
          >
            <XIcon className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
