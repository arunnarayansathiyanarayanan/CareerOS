import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getClerkAppSession } from "@/lib/auth";
import { isSkillOntologyValue } from "@/lib/constants/skillOntology";
import { getDb } from "@/db";
import { projectTemplates, projects, recruiterShareTokens } from "@/db/schema/projects";
import { toProjectJson } from "@/lib/projectsApiShared";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const uuidSchema = z.string().uuid();

const patchBodySchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    one_liner: z.string().min(1).max(500).optional(),
    problem_solved: z.string().min(100).optional(),
    ai_stack: z
      .array(z.string())
      .refine((arr) => arr.every(isSkillOntologyValue), {
        message: "Each ai_stack item must be listed in SKILL_ONTOLOGY",
      })
      .optional(),
    my_role: z.string().min(1).max(500).optional(),
    outcome: z.string().min(1).max(5000).optional(),
    privacy_mode: z.enum(["public", "unlisted", "recruiter_share"]).optional(),
    template_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: "At least one field is required",
  });

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function sameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
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

    const { id } = await context.params;
    if (!uuidSchema.safeParse(id).success) {
      return jsonErr(400, { error: "Invalid project id", code: "INVALID_ID" });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(400, { error: "Invalid JSON body", code: "INVALID_JSON" });
    }

    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr(422, {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        fields: parsed.error.flatten(),
      });
    }

    const db = getDb();
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.isDeleted, false)))
      .limit(1);

    if (!row) {
      return jsonErr(404, { error: "Project not found", code: "NOT_FOUND" });
    }
    if (row.userId !== appUser.id) {
      return jsonErr(403, {
        error: "You must be the project owner to update this project.",
        code: "FORBIDDEN_OWNERSHIP",
      });
    }

    if (parsed.data.template_id !== undefined && parsed.data.template_id !== null) {
      const [t] = await db
        .select({ id: projectTemplates.id })
        .from(projectTemplates)
        .where(eq(projectTemplates.id, parsed.data.template_id))
        .limit(1);
      if (!t) {
        return jsonErr(400, { error: "Invalid template_id", code: "INVALID_TEMPLATE" });
      }
    }

    const patch = parsed.data;
    const update: Partial<typeof projects.$inferInsert> = {};

    if (patch.title !== undefined) update.title = patch.title;
    if (patch.one_liner !== undefined) update.oneLiner = patch.one_liner;
    if (patch.problem_solved !== undefined) update.problemSolved = patch.problem_solved;
    if (patch.my_role !== undefined) update.myRole = patch.my_role;
    if (patch.outcome !== undefined) update.outcome = patch.outcome;
    if (patch.privacy_mode !== undefined) update.privacyMode = patch.privacy_mode;
    if (patch.template_id !== undefined) update.templateId = patch.template_id;

    if (patch.ai_stack !== undefined) {
      update.aiStack = patch.ai_stack;
      if (!sameStringArray(patch.ai_stack, row.aiStack)) {
        update.aiReviewerScore = null;
        update.aiReviewerData = null;
        update.aiReviewerCallCount = 0;
      }
    }

    const [updated] = await db
      .update(projects)
      .set(update)
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return jsonErr(500, { error: "Update failed", code: "INTERNAL_ERROR" });
    }

    return NextResponse.json({ project: toProjectJson(updated) });
  } catch (e) {
    console.error("[projects/:id PATCH]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
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

    const { id } = await context.params;
    if (!uuidSchema.safeParse(id).success) {
      return jsonErr(400, { error: "Invalid project id", code: "INVALID_ID" });
    }

    const db = getDb();

    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.isDeleted, false)))
      .limit(1);

    if (!row) {
      return jsonErr(404, { error: "Project not found", code: "NOT_FOUND" });
    }
    if (row.userId !== appUser.id) {
      return jsonErr(403, {
        error: "You must be the project owner to delete this project.",
        code: "FORBIDDEN_OWNERSHIP",
      });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({ isDeleted: true, publishedAt: null })
        .where(eq(projects.id, id));

      await tx
        .update(recruiterShareTokens)
        .set({ isRevoked: true })
        .where(eq(recruiterShareTokens.projectId, id));
    });

    return NextResponse.json({
      message:
        "Project deleted. Public URL will return 404. All recruiter share links have been invalidated.",
    });
  } catch (e) {
    console.error("[projects/:id DELETE]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
