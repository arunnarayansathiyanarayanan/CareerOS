import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { createId } from "@paralleldrive/cuid2";
import mammoth from "mammoth";
import OpenAI from "openai";

import { getDb } from "@/db";
import { resumes, type FileType } from "@/db/schema/resume";
import {
  ParsedResumeSchema,
  ResumeParseError,
  ResumeUploadError,
  type ParsedResume,
} from "@/lib/resume/types";

const MAX_BYTES = 5 * 1024 * 1024;

const MIME_TO_FILE_TYPE: Record<string, FileType> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/plain": "TXT",
};

const EXT_TO_FILE_TYPE: Record<string, FileType> = {
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
};

const FILE_TYPE_TO_EXT: Record<FileType, string> = {
  PDF: "pdf",
  DOCX: "docx",
  TXT: "txt",
};

const FILE_TYPE_TO_CONTENT_TYPE: Record<FileType, string> = {
  PDF: "application/pdf",
  DOCX:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TXT: "text/plain",
};

const PARSED_RESUME_JSON_SCHEMA = `{
  "contact": {
    "name": string | null,
    "email": string | null,
    "phone": string | null,
    "location": string | null,
    "linkedin": string | null,
    "github": string | null,
    "portfolio": string | null
  },
  "summary": string | null,
  "experience": [{ "company": string, "title": string, "duration": string, "bullets": string[] }],
  "skills": string[],
  "projects": [{ "name": string, "description": string, "stack": string[], "outcome": string | null }],
  "education": [{ "institution": string, "degree": string, "year": string | null }],
  "certifications": [{ "name": string, "issuer": string | null, "year": string | null }]
}`;

const STRUCTURE_SYSTEM_PROMPT =
  "You are a resume parser. Return ONLY valid JSON — no markdown, no explanation. Preserve ALL factual claims exactly. Never infer or fabricate. Missing fields = null.";

let r2Client: S3Client | undefined;

function getR2Endpoint(): string {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  if (endpoint) return endpoint;

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  if (accountId) {
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }

  throw new Error("Missing R2_ENDPOINT or R2_ACCOUNT_ID");
}

function getR2Bucket(): string {
  const bucket =
    process.env.R2_BUCKET?.trim() ?? process.env.R2_BUCKET_NAME?.trim();
  if (!bucket) {
    throw new Error("Missing R2_BUCKET or R2_BUCKET_NAME");
  }
  return bucket;
}

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY");
  }

  const config: S3ClientConfig = {
    region: "auto",
    endpoint: getR2Endpoint(),
    credentials: { accessKeyId, secretAccessKey },
  };

  r2Client = new S3Client(config);
  return r2Client;
}

function extensionFromFileName(name: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

function resolveFileType(file: File): FileType | null {
  const mime = (file.type || "").toLowerCase();
  if (mime && MIME_TO_FILE_TYPE[mime]) {
    return MIME_TO_FILE_TYPE[mime];
  }

  const ext = extensionFromFileName(file.name);
  if (ext && EXT_TO_FILE_TYPE[ext]) {
    return EXT_TO_FILE_TYPE[ext];
  }

  return null;
}

async function objectBodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new ResumeParseError("Resume file not found in storage");
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof (body as { transformToByteArray: () => Promise<Uint8Array> })
      .transformToByteArray === "function"
  ) {
    return Buffer.from(
      await (
        body as { transformToByteArray: () => Promise<Uint8Array> }
      ).transformToByteArray()
    );
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function stripJsonFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "");
  }
  return text.trim();
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}

export async function uploadResume(
  file: File,
  userId: string
): Promise<typeof resumes.$inferSelect> {
  const fileType = resolveFileType(file);
  if (!fileType) {
    throw new ResumeUploadError("Only PDF, DOCX, or TXT files are supported.");
  }

  if (file.size > MAX_BYTES) {
    throw new ResumeUploadError("File must be under 5MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = FILE_TYPE_TO_EXT[fileType];
  const storageKey = `resumes/${userId}/${createId()}.${ext}`;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: storageKey,
      Body: buffer,
      ContentType: FILE_TYPE_TO_CONTENT_TYPE[fileType],
    })
  );

  const db = getDb();
  const [row] = await db
    .insert(resumes)
    .values({
      userId,
      originalFileName: file.name,
      storageKey,
      fileType,
      fileSizeBytes: file.size,
    })
    .returning();

  if (!row) {
    throw new ResumeUploadError("Failed to save resume metadata.");
  }

  return row;
}

export async function parseResume(
  storageKey: string,
  fileType: FileType
): Promise<ParsedResume> {
  const response = await getR2Client().send(
    new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: storageKey,
    })
  );

  const buffer = await objectBodyToBuffer(response.Body);

  let rawText: string;
  switch (fileType) {
    case "PDF":
      rawText = await extractPdfText(buffer);
      break;
    case "DOCX": {
      const { value } = await mammoth.extractRawText({ buffer });
      rawText = value?.trim() ?? "";
      break;
    }
    case "TXT":
      rawText = buffer.toString("utf-8").trim();
      break;
    default:
      throw new ResumeParseError("Unsupported resume file type");
  }

  return structureResumeText(rawText);
}

export async function structureResumeText(
  rawText: string
): Promise<ParsedResume> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ResumeParseError("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey });
  const userPrompt = `${rawText}

Return JSON matching this schema exactly:
${PARSED_RESUME_JSON_SCHEMA}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STRUCTURE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!content) {
    throw new ResumeParseError("Failed to parse resume structure");
  }

  try {
    const parsed: unknown = JSON.parse(stripJsonFences(content));
    return ParsedResumeSchema.parse(parsed);
  } catch {
    throw new ResumeParseError("Failed to parse resume structure");
  }
}
