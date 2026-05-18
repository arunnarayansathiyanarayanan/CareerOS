import { createId } from "@paralleldrive/cuid2";
import { addDays, startOfDay, subDays } from "date-fns";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { format, fromZonedTime, toZonedTime } from "date-fns-tz";

import { db } from "@/server/db";
import {
  streakEvents,
  streaks,
  type StreakEventType,
} from "@/server/db/schema/community.schema";
import { redis } from "@/server/redis";

const IST = "Asia/Kolkata";

function getTodayIST(): string {
  return format(toZonedTime(new Date(), IST), "yyyy-MM-dd");
}

function getYesterdayIST(): string {
  return format(toZonedTime(subDays(new Date(), 1), IST), "yyyy-MM-dd");
}

function secondsUntilMidnightIST(): number {
  const nowUtc = new Date();
  const istNow = toZonedTime(nowUtc, IST);
  const nextMidnightUtc = fromZonedTime(
    addDays(startOfDay(istNow), 1),
    IST,
  );
  return Math.max(
    1,
    Math.ceil((nextMidnightUtc.getTime() - nowUtc.getTime()) / 1000),
  );
}

export async function recordStreakEvent(
  userId: string,
  eventType: StreakEventType,
  metadata: Record<string, unknown> = {},
): Promise<typeof streaks.$inferSelect> {
  await db.insert(streakEvents).values({
    id: createId(),
    userId,
    eventType,
    metadata,
    occurredAt: new Date(),
  });

  const isNew = await redis.set(
    `streak:shipped:${userId}:${getTodayIST()}`,
    "1",
    { nx: true, ex: secondsUntilMidnightIST() },
  );

  if (isNew === null) {
    const [row] = await db
      .select()
      .from(streaks)
      .where(eq(streaks.userId, userId));
    if (!row) {
      throw new Error("Streak row missing after daily ship lock");
    }
    return row;
  }

  const [row] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.userId, userId));

  const today = getTodayIST();
  const newStreak =
    row?.lastShipDate === getYesterdayIST() ? row.currentStreak + 1 : 1;
  const newLongest = Math.max(row?.longestStreak ?? 0, newStreak);

  const [updated] = await db
    .insert(streaks)
    .values({
      id: createId(),
      userId,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastShipDate: today,
    })
    .onConflictDoUpdate({
      target: streaks.userId,
      set: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastShipDate: today,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!updated) {
    throw new Error("Failed to upsert streak");
  }

  return updated;
}

export async function getUserStreak(
  userId: string,
): Promise<typeof streaks.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.userId, userId));
  return row ?? null;
}

export async function getRecentStreakEvents(
  userId: string,
  limit = 30,
): Promise<(typeof streakEvents.$inferSelect)[]> {
  const since = subDays(new Date(), 30);
  return db
    .select()
    .from(streakEvents)
    .where(
      and(eq(streakEvents.userId, userId), gte(streakEvents.occurredAt, since)),
    )
    .orderBy(desc(streakEvents.occurredAt))
    .limit(limit);
}

export async function checkAndResetExpiredStreaks(): Promise<number> {
  const yesterday = getYesterdayIST();
  const result = await db
    .update(streaks)
    .set({ currentStreak: 0, updatedAt: new Date() })
    .where(
      and(
        lt(streaks.lastShipDate, yesterday),
        sql`${streaks.currentStreak} > 0`,
      ),
    )
    .returning({ id: streaks.id });
  return result.length;
}
