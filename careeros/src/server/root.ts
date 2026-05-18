import { communityRouter } from "./routers/community.router";
import { profileRouter } from "./routers/profile";
import { projectRouter } from "./routers/project";
import { router } from "./trpc";

export const appRouter = router({
  profile: profileRouter,
  project: projectRouter,
  community: communityRouter,
});

export type AppRouter = typeof appRouter;
