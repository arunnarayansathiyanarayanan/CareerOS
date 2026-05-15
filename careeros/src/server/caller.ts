import { createCallerFactory } from "./trpc";
import { appRouter } from "./root";

export const createCaller = createCallerFactory(appRouter);
