import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/root";

type CommunityOutputs = inferRouterOutputs<AppRouter>["community"];

export type PostWithMeta =
  CommunityOutputs["post"]["getFeed"]["posts"][number];

export type LeaderboardEntryWithMeta =
  CommunityOutputs["leaderboard"]["getCohort"]["entries"][number];

export type LeaderboardPageData =
  CommunityOutputs["leaderboard"]["getCohort"];
