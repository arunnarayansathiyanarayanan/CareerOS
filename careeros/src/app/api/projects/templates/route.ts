import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { projectTemplates } from "@/db/schema/projects";

export const runtime = "nodejs";

const querySchema = z.object({
  role: z.string().min(1).optional(),
});

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      role: url.searchParams.get("role") ?? undefined,
    });
    if (!parsed.success) {
      return jsonErr(400, {
        error: "Invalid query",
        code: "VALIDATION_ERROR",
        fields: parsed.error.flatten(),
      });
    }

    const { role } = parsed.data;
    const db = getDb();
    const rows = await db.select().from(projectTemplates);

    const filtered =
      role ? rows.filter((r) => r.targetRoles.includes(role)) : rows;

    return NextResponse.json({
      templates: filtered.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        problem_statement: t.problemStatement,
        recommended_stack: t.recommendedStack,
        success_criteria: t.successCriteria,
        completion_checklist: t.completionChecklist,
        target_roles: t.targetRoles,
        created_at: t.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[projects/templates GET]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
