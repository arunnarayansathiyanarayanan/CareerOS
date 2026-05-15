import { profileRouter } from "./routers/profile";
import { projectRouter } from "./routers/project";
import { router } from "./trpc";

export const appRouter = router({
  profile: profileRouter,
  project: projectRouter,
});

export type AppRouter = typeof appRouter;
