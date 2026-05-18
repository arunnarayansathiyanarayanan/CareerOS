import { communityRouter } from "./routers/community.router";
import { profileRouter } from "./routers/profile";
import { projectRouter } from "./routers/project";
import { skillIntelligenceRouter } from "./routers/skillIntelligence";
import { router } from "./trpc";

export const appRouter = router({
  profile: profileRouter,
  project: projectRouter,
  community: communityRouter,
  skillIntelligence: skillIntelligenceRouter,
});

export type AppRouter = typeof appRouter;
