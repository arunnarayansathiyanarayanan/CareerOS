import { and, count, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getClerkAppSession } from "@/lib/auth";
import { getDb } from "@/db";
import type { ProjectEmbedType } from "@/db/schema/projects";
import { projectEmbeds, projects } from "@/db/schema/projects";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  PROJECT_EMBEDS_BUCKET,
  toEmbedJson,
} from "@/lib/projectsApiShared";

export const runtime = "nodejs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LINK_TYPES = new Set([
  "github",
  "loom",
  "youtube",
  "notion",
  "deployed_url",
]);

const FILE_TYPES = new Set(["screenshot", "pdf"]);

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_SCREENSHOTS = 10;

const SCREENSHOT_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function safeFileName(name: string): string {
  const base = name
    .replace(/^[\\/]+/, "")
    .replace(/.*[\\/]/, "")
    .slice(0, 180);
  const safe = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return safe.length > 0 ? safe : "file";
}

const jsonEmbedSchema = z
  .object({
    type: z.string(),
    url: z.string().url().optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request, context: RouteContext) {
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

    const db = getDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || project.isDeleted) {
      return jsonErr(404, { error: "Project not found", code: "NOT_FOUND" });
    }
    if (project.userId !== appUser.id) {
      return jsonErr(403, {
        error: "You must be the project owner to manage embeds.",
        code: "FORBIDDEN_OWNERSHIP",
      });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let embedType: string;
    let url: string | undefined;
    let file: File | undefined;

    if (contentType.toLowerCase().includes("multipart/form-data")) {
      const form = await req.formData();
      embedType = String(form.get("type") ?? "").trim();
      const u = form.get("url");
      url = typeof u === "string" && u.trim() ? u.trim() : undefined;
      const f = form.get("file");
      file = f instanceof File && f.size > 0 ? f : undefined;
    } else {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return jsonErr(400, { error: "Invalid JSON body", code: "INVALID_JSON" });
      }
      const parsed = jsonEmbedSchema.safeParse(body);
      if (!parsed.success) {
        return jsonErr(422, {
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          fields: parsed.error.flatten(),
        });
      }
      embedType = parsed.data.type;
      url = parsed.data.url;
    }

    if (!LINK_TYPES.has(embedType) && !FILE_TYPES.has(embedType)) {
      return jsonErr(400, { error: "Invalid embed type", code: "INVALID_TYPE" });
    }

    if (LINK_TYPES.has(embedType) && url) {
      try {
        new URL(url);
      } catch {
        return jsonErr(400, { error: "Invalid url", code: "INVALID_URL" });
      }
    }

    const [ordRow] = await db
      .select({ v: max(projectEmbeds.displayOrder) })
      .from(projectEmbeds)
      .where(eq(projectEmbeds.projectId, projectId));

    const nextOrder = Number(ordRow?.v ?? 0) + 1;

    if (LINK_TYPES.has(embedType)) {
      if (!url) {
        return jsonErr(422, {
          error: "url is required for this embed type",
          code: "URL_REQUIRED",
        });
      }
      const [embed] = await db
        .insert(projectEmbeds)
        .values({
          projectId,
          type: embedType as ProjectEmbedType,
          url,
          displayOrder: nextOrder,
        })
        .returning();

      if (!embed) {
        return jsonErr(500, { error: "Insert failed", code: "INTERNAL_ERROR" });
      }
      return NextResponse.json({ embed: toEmbedJson(embed) });
    }

    if (embedType === "screenshot") {
      const [cntRow] = await db
        .select({ n: count() })
        .from(projectEmbeds)
        .where(
          and(
            eq(projectEmbeds.projectId, projectId),
            eq(projectEmbeds.type, "screenshot")
          )
        );
      if (Number(cntRow?.n ?? 0) >= MAX_SCREENSHOTS) {
        return jsonErr(422, {
          error: `Maximum of ${MAX_SCREENSHOTS} screenshots per project`,
          code: "SCREENSHOT_LIMIT",
        });
      }
    }

    if (!file) {
      return jsonErr(422, {
        error: "file is required for screenshot and pdf embeds (multipart field \"file\")",
        code: "FILE_REQUIRED",
      });
    }

    if (file.size > MAX_BYTES) {
      return jsonErr(413, {
        error: "File exceeds 25 MB limit",
        code: "FILE_TOO_LARGE",
      });
    }

    const mime = (file.type || "").toLowerCase();
    if (embedType === "pdf" && mime !== "application/pdf") {
      return jsonErr(400, {
        error: "PDF embeds must be application/pdf",
        code: "INVALID_FILE_TYPE",
      });
    }
    if (embedType === "screenshot" && !SCREENSHOT_MIMES.has(mime)) {
      return jsonErr(400, {
        error: "Screenshot must be an image (png, jpeg, webp, or gif)",
        code: "INVALID_FILE_TYPE",
      });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const safe = safeFileName(file.name);
    const objectPath = `${projectId}/${Date.now()}-${safe}`;

    const supabase = getSupabaseAdmin();
    const { error: upErr } = await supabase.storage
      .from(PROJECT_EMBEDS_BUCKET)
      .upload(objectPath, buf, { contentType: mime || "application/octet-stream", upsert: false });

    if (upErr) {
      console.error("[project embeds] storage:", upErr);
      return jsonErr(502, { error: "Failed to store file", code: "STORAGE_ERROR" });
    }

    try {
      const [embed] = await db
        .insert(projectEmbeds)
        .values({
          projectId,
          type: embedType as ProjectEmbedType,
          storageKey: objectPath,
          fileSizeBytes: file.size,
          displayOrder: nextOrder,
        })
        .returning();

      if (!embed) {
        throw new Error("Insert failed");
      }
      return NextResponse.json({ embed: toEmbedJson(embed) }, { status: 201 });
    } catch (e) {
      await supabase.storage.from(PROJECT_EMBEDS_BUCKET).remove([objectPath]);
      throw e;
    }
  } catch (e) {
    console.error("[projects/:id/embeds POST]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}