import { and, eq, isNull, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { roadmaps } from "@/db/schema/roadmap";
import { regenerateRoadmap } from "@/services/regenerateRoadmap";

export const runtime = "nodejs";

const BATCH_SIZE = 10;
const REGEN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const cutoff = new Date(Date.now() - REGEN_INTERVAL_MS);

  const rows = await db
    .select({ userId: roadmaps.userId })
    .from(roadmaps)
    .where(
      and(
        eq(roadmaps.status, "active"),
        or(isNull(roadmaps.lastRegenAt), lt(roadmaps.lastRegenAt, cutoff))
      )
    );

  const userIds = [...new Set(rows.map((row) => row.userId))];
  let succeeded = 0;
  let failed = 0;

  for (const batch of chunk(userIds, BATCH_SIZE)) {
    const results = await Promise.allSettled(
      batch.map((userId) => regenerateRoadmap(userId, db))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    }
  }

  return NextResponse.json({
    processed: userIds.length,
    succeeded,
    failed,
  });
}
