import { and, eq, sql } from "drizzle-orm";

import { users } from "@/db/schema/users";
import { guardCron } from "@/lib/cronGuard";
import { db } from "@/server/db";
import {
  buildChallenges,
  notifications,
  type NewNotification,
} from "@/server/db/schema/community.schema";

export const runtime = "nodejs";

const NOTIFY_CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function notifyAllUsersOfActiveChallenges(
  challenges: (typeof buildChallenges.$inferSelect)[],
): Promise<void> {
  if (challenges.length === 0) return;

  const allUsers = await db.select({ id: users.id }).from(users);
  if (allUsers.length === 0) return;

  for (const challenge of challenges) {
    const rows: NewNotification[] = allUsers.map((user) => ({
      userId: user.id,
      type: "CHALLENGE_ACTIVE",
      payload: {
        challengeId: challenge.id,
        title: challenge.title,
      },
    }));

    for (const batch of chunk(rows, NOTIFY_CHUNK_SIZE)) {
      await db.insert(notifications).values(batch);
    }
  }
}

// Vercel cron: "0 * * * *"
export async function POST(req: Request) {
  try {
    guardCron(req);
    const now = new Date();

    const upcomingToActive = await db
      .update(buildChallenges)
      .set({ status: "ACTIVE" })
      .where(
        and(
          eq(buildChallenges.status, "UPCOMING"),
          sql`${buildChallenges.startsAt} <= ${now}`,
        ),
      )
      .returning();

    const activeToVoting = await db
      .update(buildChallenges)
      .set({ status: "VOTING" })
      .where(
        and(
          eq(buildChallenges.status, "ACTIVE"),
          sql`${buildChallenges.submissionDeadline} <= ${now}`,
        ),
      )
      .returning();

    const votingToClosed = await db
      .update(buildChallenges)
      .set({ status: "CLOSED" })
      .where(
        and(
          eq(buildChallenges.status, "VOTING"),
          sql`${buildChallenges.votingDeadline} <= ${now}`,
        ),
      )
      .returning();

    await notifyAllUsersOfActiveChallenges(upcomingToActive);

    const transitioned =
      upcomingToActive.length +
      activeToVoting.length +
      votingToClosed.length;

    return Response.json({ transitioned });
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
