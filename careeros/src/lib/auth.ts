import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import type { User } from "@/db/schema/users";
import { users } from "@/db/schema/users";

/** Clerk `userId` when signed in; otherwise `null`. */
export async function getSessionClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export type ClerkAppSession =
  | { status: "signed_out" }
  | { status: "missing_app_user"; clerkUserId: string }
  | { status: "authenticated"; clerkUserId: string; appUser: User };

/**
 * Maps Clerk auth to the app `users` row. Use this in API routes to return
 * correct 401 vs 403 when the app user record has not been created yet.
 */
export async function getClerkAppSession(): Promise<ClerkAppSession> {
  const clerkUserId = await getSessionClerkUserId();
  if (!clerkUserId) return { status: "signed_out" };

  const db = getDb();
  const [appUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!appUser) return { status: "missing_app_user", clerkUserId };
  return { status: "authenticated", clerkUserId, appUser };
}
