"use client";

import * as React from "react";

import { PostCard } from "@/components/community/PostCard";
import { PostComposer } from "@/components/community/PostComposer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/trpc/react";

export type CommunityFeedProps = {
  cohortId?: string;
  currentUserId?: string;
};

export function CommunityFeed({
  cohortId: initialCohortId,
  currentUserId,
}: CommunityFeedProps) {
  const [tab, setTab] = React.useState<"cohort" | "global">(
    initialCohortId ? "cohort" : "global",
  );
  const activeCohortId = tab === "cohort" ? initialCohortId : undefined;
  const feedInput = React.useMemo(
    () => ({ cohortId: activeCohortId, limit: 20 as const }),
    [activeCohortId],
  );

  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = api.community.post.getFeed.useInfiniteQuery(feedInput, {
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];
  const isCohortEmpty =
    !isLoading && tab === "cohort" && posts.length === 0;

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "cohort" | "global")}
      >
        <TabsList className="w-full">
          <TabsTrigger value="cohort" disabled={!initialCohortId}>
            My Cohort
          </TabsTrigger>
          <TabsTrigger value="global">Global</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-4">
          <PostComposer
            cohortId={activeCohortId}
            onPost={() => void refetch()}
          />

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-xl bg-zinc-800/50"
                />
              ))}
            </div>
          ) : isCohortEmpty ? (
            <p className="py-16 text-center text-zinc-500">
              Your cohort is quiet. Be the first to ship something today.
            </p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                  feedQueryKey={feedInput}
                />
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="h-1" aria-hidden />

          {isFetchingNextPage ? (
            <div className="h-32 animate-pulse rounded-xl bg-zinc-800/50" />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
