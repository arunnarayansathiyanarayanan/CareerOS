import { initTRPC, TRPCError } from "@trpc/server";

import type { DrizzleDB } from "@/db/types";
import type { User } from "@/db/schema/users";
import { getClerkAppSession } from "@/lib/auth";

/** Request context for CareerOS tRPC procedures (DB + request headers). */
export type TRPCContext = {
  db: DrizzleDB;
  headers: Headers | null;
};

/**
 * Build context for a tRPC request. Call from the Next.js Route Handler or
 * server caller that wraps `fetchRequestHandler`.
 */
export async function createTRPCContext(opts?: {
  headers?: Headers | null;
}): Promise<TRPCContext> {
  let h: Headers | null = opts?.headers ?? null;
  if (!h) {
    const { headers } = await import("next/headers");
    h = await headers();
  }
  const { getDb } = await import("@/db");
  return { db: getDb(), headers: h };
}

type AuthedTRPCContext = TRPCContext & { appUser: User };

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

export const publicProcedure = t.procedure;

const requireAppUser = middleware(async ({ next }) => {
  const session = await getClerkAppSession();

  if (session.status === "signed_out") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
  }

  if (session.status === "missing_app_user") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "App user is not provisioned.",
    });
  }

  return next({
    ctx: {
      appUser: session.appUser,
    } satisfies Partial<AuthedTRPCContext>,
  });
});

/** Procedure that guarantees `ctx.appUser` (Clerk mapped to `users` row). */
export const protectedProcedure = t.procedure.use(requireAppUser);

export type { AuthedTRPCContext };
