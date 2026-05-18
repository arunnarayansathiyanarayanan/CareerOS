"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ExternalLinkIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  ThumbsUpIcon,
  ZapIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import type { PostWithMeta } from "@/components/community/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/db/schema/profile";
import { PROFILE_TARGET_ROLE_LABELS } from "@/lib/profileDisplay";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export type PostCardProps = {
  post: PostWithMeta;
  currentUserId?: string;
  feedQueryKey?: { cohortId?: string; limit?: number };
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function PostCard({
  post,
  currentUserId,
  feedQueryKey = { limit: 20 },
}: PostCardProps) {
  const utils = api.useUtils();
  const [expanded, setExpanded] = React.useState(false);
  const [liked, setLiked] = React.useState(post.userHasLiked);
  const [inspiring, setInspiring] = React.useState(post.userHasInspiring);
  const [likeCount, setLikeCount] = React.useState(post.likeCount);
  const [inspiringCount, setInspiringCount] = React.useState(
    post.inspiringCount,
  );

  const roleLabel =
    PROFILE_TARGET_ROLE_LABELS[
      post.author.targetRole as Profile["targetRole"]
    ] ?? post.author.targetRole;

  const reactMutation = api.community.post.react.useMutation({
    onMutate: async ({ postId, type }) => {
      const input = { ...feedQueryKey, limit: feedQueryKey.limit ?? 20 };
      await utils.community.post.getFeed.cancel(input);

      const previous = utils.community.post.getFeed.getInfiniteData(input);

      if (type === "LIKE" && !liked) {
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
      if (type === "INSPIRING" && !inspiring) {
        setInspiring(true);
        setInspiringCount((c) => c + 1);
      }

      utils.community.post.getFeed.setInfiniteData(input, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    userHasLiked: type === "LIKE" ? true : p.userHasLiked,
                    userHasInspiring:
                      type === "INSPIRING" ? true : p.userHasInspiring,
                    likeCount:
                      type === "LIKE" && !liked ? p.likeCount + 1 : p.likeCount,
                    inspiringCount:
                      type === "INSPIRING" && !inspiring
                        ? p.inspiringCount + 1
                        : p.inspiringCount,
                  }
                : p,
            ),
          })),
        };
      });

      return { previous, input };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && context.input) {
        utils.community.post.getFeed.setInfiniteData(
          context.input,
          context.previous,
        );
      }
      setLiked(post.userHasLiked);
      setInspiring(post.userHasInspiring);
      setLikeCount(post.likeCount);
      setInspiringCount(post.inspiringCount);
      toast.error("Could not save reaction");
    },
    onSettled: (_data, _err, _vars, context) => {
      if (context?.input) {
        void utils.community.post.getFeed.invalidate(context.input);
      }
    },
  });

  const reportMutation = api.community.post.report.useMutation({
    onSuccess: () => toast.success("Report submitted"),
    onError: (e) => toast.error(e.message),
  });

  function handleReact(type: "LIKE" | "INSPIRING") {
    if (!currentUserId) return;
    if (type === "LIKE" && liked) return;
    if (type === "INSPIRING" && inspiring) return;
    reactMutation.mutate({ postId: post.id, type });
  }

  function handleReport() {
    reportMutation.mutate({
      contentType: "POST",
      contentId: post.id,
      reason: "Reported from community feed",
    });
  }

  const createdAt = new Date(post.createdAt);

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <header className="flex items-start gap-3">
        {post.author.imageUrl ? (
          <Image
            src={post.author.imageUrl}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-zinc-300"
            aria-hidden
          >
            {initials(post.author.displayName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-semibold text-zinc-100">
              {post.author.displayName}
            </span>
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {roleLabel}
            </span>
            <span className="text-zinc-600">·</span>
            <time
              dateTime={createdAt.toISOString()}
              className="text-xs text-zinc-500"
            >
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </time>
          </div>
        </div>
      </header>

      <div className="mt-3">
        <p
          className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap text-zinc-300",
            !expanded && "line-clamp-4",
          )}
        >
          {post.content}
        </p>
        {post.content.length > 200 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>

      {post.linkedProject ? (
        <Link
          href={`/projects/${post.linkedProject.slug}`}
          className="mt-2 flex items-center justify-between rounded-lg border border-zinc-800 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/40"
        >
          <span className="text-sm font-medium text-zinc-200">
            {post.linkedProject.title}
          </span>
          <ExternalLinkIcon className="size-4 shrink-0 text-zinc-500" />
        </Link>
      ) : null}

      {post.taggedSkills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.taggedSkills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500"
            >
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <footer className="mt-4 flex items-center gap-1 border-t border-zinc-800/80 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!currentUserId || reactMutation.isPending}
          onClick={() => handleReact("LIKE")}
          className={cn(
            "h-8 gap-1.5 text-zinc-400 hover:text-zinc-200",
            liked && "text-zinc-100",
          )}
        >
          <ThumbsUpIcon className="size-3.5" />
          <span className="tabular-nums">{likeCount}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!currentUserId || reactMutation.isPending}
          onClick={() => handleReact("INSPIRING")}
          className={cn(
            "h-8 gap-1.5 text-zinc-400 hover:text-zinc-200",
            inspiring && "text-amber-400",
          )}
        >
          <ZapIcon className="size-3.5" />
          <span className="tabular-nums">{inspiringCount}</span>
        </Button>

        <div className="flex h-8 items-center gap-1.5 px-2.5 text-sm text-zinc-400">
          <MessageCircleIcon className="size-3.5" />
          <span className="tabular-nums">{post.commentCount}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto text-zinc-500 hover:text-zinc-300"
              aria-label="Post options"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={handleReport}
              disabled={reportMutation.isPending}
            >
              Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </footer>
    </article>
  );
}
