import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { roadmapItems, roadmaps } from "@/db/schema/roadmap";
import { users } from "@/db/schema/users";
import type { RoadmapItem } from "@/types/roadmap";

export const runtime = "nodejs";

const completionChecklistPatchSchema = z.object({
  deployedLink: z.boolean().optional(),
  githubRepo: z.boolean().optional(),
  loomDemo: z.boolean().optional(),
  writeUp: z.boolean().optional(),
});

const patchBodySchema = z
  .object({
    userNote: z.string().max(2000).nullable().optional(),
    status: z.enum(["in_progress", "skipped"]).optional(),
    proofOfWorkUrl: z.union([z.string().url(), z.literal("")]).nullable().optional(),
    completionChecklist: completionChecklistPatchSchema.optional(),
  })
  .refine(
    (body) =>
      body.userNote !== undefined ||
      body.status !== undefined ||
      body.proofOfWorkUrl !== undefined ||
      body.completionChecklist !== undefined,
    { message: "At least one field is required" }
  );

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(
  status: number,
  body: Record<string, unknown>
): NextResponse {
  return NextResponse.json(body, { status });
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return jsonError(401, {
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
    }

    const { id: itemId } = await context.params;
    if (!z.string().uuid().safeParse(itemId).success) {
      return jsonError(400, {
        error: "Invalid item id",
        code: "INVALID_ITEM_ID",
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

    const parsed = patchBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return jsonError(400, {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const db = getDb();

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return jsonError(403, { error: "Forbidden", code: "FORBIDDEN" });
    }

    const [item] = await db
      .select()
      .from(roadmapItems)
      .where(eq(roadmapItems.id, itemId))
      .limit(1);

    if (!item) {
      return jsonError(404, { error: "Item not found", code: "NOT_FOUND" });
    }

    const [roadmap] = await db
      .select()
      .from(roadmaps)
      .where(and(eq(roadmaps.id, item.roadmapId), eq(roadmaps.userId, user.id)))
      .limit(1);

    if (!roadmap) {
      return jsonError(403, { error: "Forbidden", code: "FORBIDDEN" });
    }

    if (item.status === "completed" && parsed.data.status !== undefined) {
      return jsonError(409, {
        error: "Completed items cannot change status",
        code: "ITEM_COMPLETED",
      });
    }

    const update: Partial<typeof roadmapItems.$inferInsert> = {};

    if (parsed.data.userNote !== undefined) {
      update.userNote = parsed.data.userNote;
    }

    if (parsed.data.status !== undefined) {
      update.status = parsed.data.status;
    }

    if (parsed.data.proofOfWorkUrl !== undefined) {
      const trimmed = parsed.data.proofOfWorkUrl?.trim() ?? "";
      update.proofOfWorkUrl = trimmed === "" ? null : trimmed;
    }

    if (parsed.data.completionChecklist !== undefined) {
      const pow =
        parsed.data.proofOfWorkUrl !== undefined ?
          (parsed.data.proofOfWorkUrl?.trim() ?? "")
        : (item.proofOfWorkUrl?.trim() ?? "");
      if (item.type === "project" && !pow) {
        return jsonError(422, {
          error: "Proof-of-work URL required before updating checklist",
          code: "POW_REQUIRED",
        });
      }
      update.completionChecklist = {
        ...(item.completionChecklist as Record<string, boolean>),
        ...parsed.data.completionChecklist,
      };
    }

    const [row] = await db
      .update(roadmapItems)
      .set(update)
      .where(eq(roadmapItems.id, itemId))
      .returning();

    if (!row) {
      return jsonError(500, {
        error: "Update failed",
        code: "INTERNAL_ERROR",
      });
    }

    return NextResponse.json({ item: row as RoadmapItem });
  } catch (error) {
    console.error("[roadmap/item PATCH] unexpected:", error);
    return jsonError(500, {
      error: "Unexpected server error",
      code: "INTERNAL_ERROR",
    });
  }
}
