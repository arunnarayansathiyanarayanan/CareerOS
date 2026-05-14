import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const SYSTEM_PROMPT =
  "You are a resume parser. Extract structured data from the resume text. Return ONLY valid JSON, no markdown.";

function jsonError(
  status: number,
  error: string,
  code: string
): NextResponse<{ error: string; code: string }> {
  return NextResponse.json({ error, code }, { status });
}

function sanitizeFilename(name: string): string {
  const base = name
    .replace(/^[\\/]+/, "")
    .replace(/.*[\\/]/, "")
    .slice(0, 180);
  const safe = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return safe.length > 0 ? safe : "resume";
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key);
}

async function countUploadsLastHour(
  supabase: SupabaseClient,
  clerkId: string
): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("resume_upload_events")
    .select("id", { count: "exact", head: true })
    .eq("clerk_id", clerkId)
    .gte("created_at", since);

  if (error) throw error;
  return count ?? 0;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value?.trim() ?? "";
}

function parseModelJson(raw: string): Record<string, unknown> {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "");
  }
  const parsed: unknown = JSON.parse(t);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Parsed resume is not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function skillsFromParsed(parsed: Record<string, unknown>): string[] {
  const skills = parsed.skills;
  if (!Array.isArray(skills)) return [];
  return skills.filter((s): s is string => typeof s === "string");
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return jsonError(401, "Authentication required", "UNAUTHORIZED");
    }

    const supabase = getSupabaseAdmin();

    const uploadCount = await countUploadsLastHour(supabase, userId);
    if (uploadCount >= 3) {
      return jsonError(
        429,
        "Maximum of 3 resume uploads per hour. Try again later.",
        "RATE_LIMITED"
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return jsonError(
        400,
        "Expected multipart/form-data",
        "INVALID_CONTENT_TYPE"
      );
    }

    const formData = await req.formData();
    const entry = formData.get("resume") ?? formData.get("file");
    if (!entry || typeof entry === "string") {
      return jsonError(
        400,
        'Missing resume file field (use "resume")',
        "FILE_MISSING"
      );
    }

    const file = entry as File;
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_TYPES.has(mime)) {
      return jsonError(400, "File must be PDF or DOCX", "INVALID_FILE_TYPE");
    }

    if (file.size > MAX_BYTES) {
      return jsonError(400, "File exceeds 5MB limit", "FILE_TOO_LARGE");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const timestamp = Date.now();
    const safeName = sanitizeFilename(file.name);
    const objectPath = `${userId}/${timestamp}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(objectPath, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) {
      console.error("[resume] storage upload:", uploadError);
      return jsonError(502, "Failed to store resume", "STORAGE_ERROR");
    }

    const { error: logError } = await supabase
      .from("resume_upload_events")
      .insert({
        clerk_id: userId,
      });
    if (logError) {
      console.error("[resume] rate event insert:", logError);
      await supabase.storage.from("resumes").remove([objectPath]);
      return jsonError(502, "Failed to record upload", "DATABASE_ERROR");
    }

    const { data: publicData } = supabase.storage
      .from("resumes")
      .getPublicUrl(objectPath);
    const resumeUrl = publicData.publicUrl;

    let text: string;
    try {
      if (mime === "application/pdf") {
        text = await extractPdfText(buffer);
      } else {
        text = await extractDocxText(buffer);
      }
    } catch (e) {
      console.error("[resume] text extraction:", e);
      return jsonError(
        422,
        "Could not read text from file",
        "TEXT_EXTRACTION_FAILED"
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return jsonError(
        500,
        "Server misconfiguration",
        "MISSING_ANTHROPIC_API_KEY"
      );
    }

    const userPrompt = `Parse this resume into JSON with this exact schema:
{
  contact: { name, email, phone, location, linkedin },
  summary: string,
  experience: [{ company, title, duration, bullets: string[] }],
  skills: string[],
  education: [{ institution, degree, year }],
  certifications: string[]
}
Resume text: ${text}`;

    const client = new Anthropic({ apiKey });
    let rawAssistant = "";
    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const block = message.content.find((b) => b.type === "text");
      rawAssistant = block && block.type === "text" ? block.text : "";
    } catch (e) {
      console.error("[resume] Claude API:", e);
      return jsonError(502, "Resume parsing service failed", "LLM_ERROR");
    }

    let resumeParsed: Record<string, unknown>;
    try {
      resumeParsed = parseModelJson(rawAssistant);
    } catch (e) {
      console.error("[resume] JSON parse:", e);
      return jsonError(502, "Invalid parser output", "PARSE_OUTPUT_INVALID");
    }

    const skillsExtracted = skillsFromParsed(resumeParsed);

    return NextResponse.json({
      success: true,
      resumeUrl,
      resumeParsed,
      skillsExtracted,
    });
  } catch (e) {
    console.error("[resume] unexpected:", e);
    return jsonError(500, "Unexpected server error", "INTERNAL_ERROR");
  }
}
