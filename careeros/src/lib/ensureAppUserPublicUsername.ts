import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema/users";

const MAX_LEN = 32;

function sanitizeHandle(raw: string): string | null {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_LEN);
  return s.length >= 3 ? s : null;
}

function handleFromClerkId(clerkUserId: string): string {
  const tail = clerkUserId.replace(/[^a-z0-9]/gi, "").slice(-10);
  const safe =
    tail.length >= 4 ? tail : clerkUserId.replace(/[^a-z0-9]/gi, "").slice(0, 10);
  return `user-${safe || "member"}`.toLowerCase().slice(0, MAX_LEN);
}

function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

/**
 * Clerk's `username` is often unset for email / OAuth accounts. Public project
 * URLs need a stable slug; derive one from Clerk profile or persist a unique fallback.
 */
export async function ensureAppUserPublicUsername(opts: {
  appUserId: string;
  clerkUserId: string;
  username: string | null;
}): Promise<string> {
  const existing = opts.username?.trim();
  if (existing) return existing;

  const clerkUser = await currentUser();

  let base: string | null = null;
  if (clerkUser?.username) {
    base = sanitizeHandle(String(clerkUser.username));
  }
  if (!base) {
    const email =
      clerkUser?.primaryEmailAddress?.emailAddress ??
      clerkUser?.emailAddresses?.[0]?.emailAddress;
    if (email?.includes("@")) {
      const local = email.split("@")[0] ?? "";
      base =
        sanitizeHandle(local) ?? sanitizeHandle(local.replace(/\./g, "-"));
    }
  }
  if (!base) {
    const fromId = handleFromClerkId(opts.clerkUserId);
    base = sanitizeHandle(fromId) ?? fromId;
  }

  const db = getDb();

  for (let i = 0; i < 24; i++) {
    const candidate =
      i === 0 ? base : `${base}-${randomSuffix()}`.slice(0, MAX_LEN);

    const [occupied] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);

    if (!occupied || occupied.id === opts.appUserId) {
      await db
        .update(users)
        .set({ username: candidate, updatedAt: new Date() })
        .where(eq(users.id, opts.appUserId));
      return candidate;
    }
  }

  const lastChance = `${base}-${randomSuffix()}-${randomSuffix()}`.slice(0, MAX_LEN);
  await db
    .update(users)
    .set({ username: lastChance, updatedAt: new Date() })
    .where(eq(users.id, opts.appUserId));
  return lastChance;
}
