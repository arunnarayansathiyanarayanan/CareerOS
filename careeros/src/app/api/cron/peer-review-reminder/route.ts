import { and, eq, lt } from "drizzle-orm";

import { projects } from "@/db/schema/projects";
import { guardCron } from "@/lib/cronGuard";
import { db } from "@/server/db";
import {
  notifications,
  peerReviews,
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

// Vercel cron: "0 */6 * * *"
export async function POST(req: Request) {
  try {
    guardCron(req);
    const cutoff = new Date(Date.now() - 36 * 60 * 60 * 1000);

    const staleReviews = await db
      .select({
        ownerId: projects.userId,
        projectId: peerReviews.projectId,
        reviewId: peerReviews.id,
      })
      .from(peerReviews)
      .innerJoin(projects, eq(peerReviews.projectId, projects.id))
      .where(
        and(
          eq(peerReviews.status, "PENDING"),
          lt(peerReviews.requestedAt, cutoff),
        ),
      );

    const seenOwners = new Set<string>();
    const rows: NewNotification[] = [];

    for (const review of staleReviews) {
      const ownerId = review.ownerId;
      if (seenOwners.has(ownerId)) continue;
      seenOwners.add(ownerId);
      rows.push({
        userId: ownerId,
        type: "REVIEW_REMINDER",
        payload: {
          projectId: review.projectId,
          reviewId: review.reviewId,
        },
      });
    }

    for (const batch of chunk(rows, NOTIFY_CHUNK_SIZE)) {
      await db.insert(notifications).values(batch);
    }

    return Response.json({ notified: rows.length });
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
