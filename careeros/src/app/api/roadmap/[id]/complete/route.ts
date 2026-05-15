import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { roadmapItems, roadmaps } from "@/db/schema/roadmap";
import { users } from "@/db/schema/users";
import {
  calculateAiNativeReadyScore,
  getScoreLabel,
} from "@/lib/calculateAiNativeReadyScore";
import { checkCompletionGate } from "@/lib/checkCompletionGate";
import type { RoadmapItem } from "@/types/roadmap";

export const runtime = "nodejs";

const completeBodySchema = z.object({
  itemId: z.string().uuid(),
  proofOfWorkUrl: z.string().url().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(
  status: number,
  body: Record<string, unknown>
): NextResponse {
  return NextResponse.json(body, { status });
}

function successPayload(
  newScore: number,
  item: RoadmapItem
): { newScore: number; scoreLabel: ReturnType<typeof getScoreLabel>; item: RoadmapItem } {
  return {
    newScore,
    scoreLabel: getScoreLabel(newScore),
    item,
  };
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return jsonError(401, {
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
    }

    const { id: roadmapId } = await context.params;
    if (!z.string().uuid().safeParse(roadmapId).success) {
      return jsonError(400, {
        error: "Invalid roadmap id",
        code: "INVALID_ROADMAP_ID",
      });
    }

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return jsonError(400, {
        error: "Invalid JSON body",
        code: "INVALID_JSON",
      });
    }

    const parsed = completeBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return jsonError(400, {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    const { itemId, proofOfWorkUrl } = parsed.data;

    const db = getDb();

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return jsonError(403, {
        error: "Forbidden",
        code: "FORBIDDEN",
      });
    }

    const [roadmap] = await db
      .select()
      .from(roadmaps)
      .where(and(eq(roadmaps.id, roadmapId), eq(roadmaps.userId, user.id)))
      .limit(1);

    if (!roadmap) {
      return jsonError(403, {
        error: "Forbidden",
        code: "FORBIDDEN",
      });
    }

    const [item] = await db
      .select()
      .from(roadmapItems)
      .where(eq(roadmapItems.id, itemId))
      .limit(1);

    if (!item || item.roadmapId !== roadmap.id) {
      return jsonError(403, {
        error: "Forbidden",
        code: "FORBIDDEN",
      });
    }

    const allItems = await db
      .select()
      .from(roadmapItems)
      .where(eq(roadmapItems.roadmapId, roadmap.id));

    if (item.status === "completed") {
      const newScore = calculateAiNativeReadyScore(allItems as RoadmapItem[]);
      return NextResponse.json(successPayload(newScore, item as RoadmapItem));
    }

    const itemForGate: RoadmapItem = {
      ...(item as RoadmapItem),
      proofOfWorkUrl:
        proofOfWorkUrl !== undefined ? proofOfWorkUrl : item.proofOfWorkUrl,
    };

    const gate = checkCompletionGate(itemForGate, allItems as RoadmapItem[]);
    if (!gate.allowed) {
      return jsonError(422, { reason: gate.reason ?? "Completion not allowed" });
    }

    const now = new Date();
    const updatePayload: Partial<typeof roadmapItems.$inferInsert> = {
      status: "completed",
      completedAt: now,
    };
    if (proofOfWorkUrl !== undefined) {
      updatePayload.proofOfWorkUrl = proofOfWorkUrl;
    }

    const updatedItem = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(roadmapItems)
        .set(updatePayload)
        .where(eq(roadmapItems.id, itemId))
        .returning();

      if (!row) {
        throw new Error("Item update returned no row");
      }

      const itemsAfter = allItems.map((i) =>
        i.id === itemId ? row : i
      ) as RoadmapItem[];

      const newScore = calculateAiNativeReadyScore(itemsAfter);

      await tx
        .update(roadmaps)
        .set({ aiNativeReadyScore: newScore })
        .where(eq(roadmaps.id, roadmap.id));

      return { row, newScore };
    });

    return NextResponse.json(
      successPayload(
        updatedItem.newScore,
        updatedItem.row as RoadmapItem
      )
    );
  } catch (error) {
    console.error("[roadmap/complete] unexpected:", error);
    return jsonError(500, {
      error: "Unexpected server error",
      code: "INTERNAL_ERROR",
    });
  }
}
