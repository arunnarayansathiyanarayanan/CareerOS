import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getClerkAppSession } from "@/lib/auth";
import { getDb } from "@/db";
import { projectEmbeds, projects } from "@/db/schema/projects";

export const runtime = "nodejs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const bodySchema = z
  .object({
    ordered_embed_ids: z.array(z.string().uuid()),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const session = await getClerkAppSession();
    if (session.status === "signed_out") {
      return jsonErr(401, { error: "Authentication required", code: "UNAUTHORIZED" });
    }
    if (session.status === "missing_app_user") {
      return jsonErr(403, {
        error: "App user not found. Complete onboarding first.",
        code: "USER_NOT_PROVISIONED",
      });
    }
    const { appUser } = session;

    const { id: projectId } = await context.params;
    if (!UUID.test(projectId)) {
      return jsonErr(400, { error: "Invalid project id", code: "INVALID_ID" });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(400, { error: "Invalid JSON body", code: "INVALID_JSON" });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr(422, {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        fields: parsed.error.flatten(),
      });
    }

    const { ordered_embed_ids: order } = parsed.data;

    const db = getDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || project.isDeleted || project.userId !== appUser.id) {
      return jsonErr(404, { error: "Project not found", code: "NOT_FOUND" });
    }

    const rows = await db
      .select({ id: projectEmbeds.id })
      .from(projectEmbeds)
      .where(eq(projectEmbeds.projectId, projectId));

    const existing = new Set(rows.map((r) => r.id));
    if (order.length !== existing.size) {
      return jsonErr(422, {
        error: "ordered_embed_ids must list every embed exactly once",
        code: "INVALID_ORDER",
      });
    }
    for (const eid of order) {
      if (!existing.has(eid)) {
        return jsonErr(422, {
          error: "ordered_embed_ids contains an embed that does not belong to this project",
          code: "INVALID_ORDER",
        });
      }
    }

    await db.transaction(async (tx) => {
      let ord = 0;
      for (const eid of order) {
        ord += 1;
        await tx
          .update(projectEmbeds)
          .set({ displayOrder: ord })
          .where(and(eq(projectEmbeds.id, eid), eq(projectEmbeds.projectId, projectId)));
      }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[projects/:id/embeds/reorder PATCH]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
