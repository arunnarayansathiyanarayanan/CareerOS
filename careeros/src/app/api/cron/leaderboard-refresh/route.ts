import { eq } from "drizzle-orm";

import { guardCron } from "@/lib/cronGuard";
import { db } from "@/server/db";
import { cohortMembers } from "@/server/db/schema/community.schema";
import { refreshLeaderboard } from "@/server/services/leaderboard.service";

export const runtime = "nodejs";

async function runLeaderboardRefresh(req: Request) {
  guardCron(req);
  const start = Date.now();

  const rows = await db
    .selectDistinct({ cohortId: cohortMembers.cohortId })
    .from(cohortMembers)
    .where(eq(cohortMembers.isActive, true));

  const ids = rows.map((r) => r.cohortId);
  for (const cohortId of ids) {
    await refreshLeaderboard(cohortId);
  }

  return Response.json({
    cohorts: ids.length,
    durationMs: Date.now() - start,
  });
}

// Vercel cron: "30 20 * * *" (20:30 UTC = 02:00 IST)
export async function GET(req: Request) {
  try {
    return await runLeaderboardRefresh(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    return await runLeaderboardRefresh(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
