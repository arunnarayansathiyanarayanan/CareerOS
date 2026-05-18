import { createId } from "@paralleldrive/cuid2";
import { getISOWeek, getYear } from "date-fns";
import { and, count, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  cohortMembers,
  cohorts,
  type Role,
} from "@/server/db/schema/community.schema";

/** Default bucket when onboarding does not collect timezone. */
export const DEFAULT_COHORT_TIMEZONE = "UTC";

export class ConflictError extends Error {
  statusCode = 409;
  constructor(msg: string) {
    super(msg);
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(msg: string) {
    super(msg);
  }
}

function utcWallClock(date: Date): Date {
  return new Date(date.getTime() + date.getTimezoneOffset() * 60_000);
}

function signupWeekStr(date = new Date()): string {
  const utc = utcWallClock(date);
  const year = getYear(utc);
  const week = getISOWeek(utc);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export async function assignUserToCohort(
  userId: string,
  targetRole: Role,
  timezone: string,
): Promise<typeof cohortMembers.$inferSelect> {
  const weekStr = signupWeekStr();

  const existing = await db
    .select({ id: cohorts.id, memberCount: count(cohortMembers.id) })
    .from(cohorts)
    .leftJoin(
      cohortMembers,
      and(
        eq(cohortMembers.cohortId, cohorts.id),
        eq(cohortMembers.isActive, true),
      ),
    )
    .where(
      and(
        eq(cohorts.targetRole, targetRole),
        eq(cohorts.timezone, timezone),
        eq(cohorts.signupWeek, weekStr),
      ),
    )
    .groupBy(cohorts.id)
    .having(sql`count(${cohortMembers.id}) < ${cohorts.maxSize}`)
    .limit(1);

  let cohortId: string;
  if (existing.length > 0) {
    cohortId = existing[0]!.id;
  } else {
    const [created] = await db
      .insert(cohorts)
      .values({
        id: createId(),
        name: `${targetRole} · ${timezone} · ${weekStr}`,
        targetRole,
        timezone,
        signupWeek: weekStr,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create cohort");
    }
    cohortId = created.id;
  }

  return db.transaction(async (tx) => {
    const active = await tx
      .select({ id: cohortMembers.id })
      .from(cohortMembers)
      .where(
        and(
          eq(cohortMembers.userId, userId),
          eq(cohortMembers.isActive, true),
        ),
      )
      .limit(1);

    if (active.length > 0) {
      throw new ConflictError("User already belongs to an active cohort");
    }

    const [inserted] = await tx
      .insert(cohortMembers)
      .values({ id: createId(), userId, cohortId })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert cohort member");
    }

    return inserted;
  });
}

export async function ensureUserCohort(
  userId: string,
  targetRole: Role,
  timezone: string = DEFAULT_COHORT_TIMEZONE,
): Promise<{
  cohort: typeof cohorts.$inferSelect;
  members: (typeof cohortMembers.$inferSelect)[];
}> {
  try {
    return await getUserCohort(userId);
  } catch (e) {
    if (!(e instanceof NotFoundError)) {
      throw e;
    }
  }

  try {
    await assignUserToCohort(userId, targetRole, timezone);
  } catch (e) {
    if (e instanceof ConflictError) {
      return getUserCohort(userId);
    }
    throw e;
  }

  return getUserCohort(userId);
}

export async function getUserCohort(
  userId: string,
): Promise<{
  cohort: typeof cohorts.$inferSelect;
  members: (typeof cohortMembers.$inferSelect)[];
}> {
  const membership = await db
    .select({ cohort: cohorts })
    .from(cohortMembers)
    .innerJoin(cohorts, eq(cohortMembers.cohortId, cohorts.id))
    .where(
      and(
        eq(cohortMembers.userId, userId),
        eq(cohortMembers.isActive, true),
      ),
    )
    .limit(1);

  if (membership.length === 0) {
    throw new NotFoundError("User is not in an active cohort");
  }

  const { cohort } = membership[0]!;

  const members = await db
    .select()
    .from(cohortMembers)
    .where(
      and(
        eq(cohortMembers.cohortId, cohort.id),
        eq(cohortMembers.isActive, true),
      ),
    );

  return { cohort, members };
}

export async function leaveCohort(userId: string): Promise<void> {
  await db
    .update(cohortMembers)
    .set({ isActive: false })
    .where(
      and(
        eq(cohortMembers.userId, userId),
        eq(cohortMembers.isActive, true),
      ),
    );
}
