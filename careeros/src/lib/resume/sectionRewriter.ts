import { diffLines, diffSentences, diffWords } from "diff";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

import { getDb } from "@/db";
import { resumeSectionRewrites, resumeVariants } from "@/db/schema/resume";
import type {
  GeneratedVariantContent,
  SectionName,
  TargetRole,
} from "@/lib/resume/types";

export interface SectionRewriteInput {
  variantId: string;
  sectionName: SectionName;
  originalText: string;
  userInstruction?: string;
  targetRole: TargetRole;
  jobDescription?: string;
}

export interface DiffHunk {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export interface SectionRewriteResult {
  sectionRewriteId: string;
  rewrittenText: string;
  diffHunks: DiffHunk[];
}

const SECTION_REWRITE_SYSTEM_PROMPT =
  "You are a resume editor. Rewrite only the section provided. Never add facts not in the original. Preserve all company names, titles, dates, and metrics exactly. Return only the rewritten section as plain text — no JSON, no labels, no markdown.";

const EXPERIENCE_JSON_APPENDIX =
  " For the EXPERIENCE section, return only a valid JSON array of objects with shape: [{ \"company\": string, \"title\": string, \"duration\": string, \"bullets\": string[] }]. No markdown fences or extra text.";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

function buildRewriteUserPrompt(input: SectionRewriteInput): string {
  const instruction =
    input.userInstruction?.trim() ||
    "Improve clarity, action verb usage, and AI relevance";

  return `Section: ${input.sectionName}
Target role: ${input.targetRole}
Instruction: ${instruction}
Job description: ${input.jobDescription?.trim() || "Not provided"}

Original:
${input.originalText}`;
}

function getSystemPrompt(sectionName: SectionName): string {
  if (sectionName === "EXPERIENCE") {
    return SECTION_REWRITE_SYSTEM_PROMPT + EXPERIENCE_JSON_APPENDIX;
  }
  return SECTION_REWRITE_SYSTEM_PROMPT;
}

function mapDiffToHunks(
  parts: Array<{ added?: boolean; removed?: boolean; value: string }>
): DiffHunk[] {
  return parts.map((part) => ({
    type: part.added ? "added" : part.removed ? "removed" : "unchanged",
    text: part.value,
  }));
}

function generateDiffHunks(
  sectionName: SectionName,
  originalText: string,
  rewrittenText: string
): DiffHunk[] {
  if (sectionName === "SUMMARY") {
    return mapDiffToHunks(diffSentences(originalText, rewrittenText));
  }
  if (sectionName === "SKILLS") {
    return mapDiffToHunks(diffWords(originalText, rewrittenText));
  }
  return mapDiffToHunks(diffLines(originalText, rewrittenText));
}

async function callOpenAIForRewrite(
  input: SectionRewriteInput
): Promise<string> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    messages: [
      { role: "system", content: getSystemPrompt(input.sectionName) },
      { role: "user", content: buildRewriteUserPrompt(input) },
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  return content;
}

function applyRewrittenSection(
  content: GeneratedVariantContent,
  sectionName: SectionName,
  rewrittenText: string
): GeneratedVariantContent {
  const updated = structuredClone(content);

  switch (sectionName) {
    case "SUMMARY":
      updated.summary = rewrittenText;
      break;
    case "SKILLS":
      updated.skills = rewrittenText.split(",").map((s) => s.trim());
      break;
    case "EXPERIENCE":
      updated.experience = JSON.parse(
        rewrittenText
      ) as GeneratedVariantContent["experience"];
      break;
    case "PROJECTS":
    case "EDUCATION":
    case "CERTIFICATIONS": {
      const key = sectionName.toLowerCase() as "projects" | "education" | "certifications";
      (updated as unknown as Record<string, unknown>)[key] = rewrittenText;
      break;
    }
  }

  return updated;
}

export async function rewriteSection(
  input: SectionRewriteInput
): Promise<SectionRewriteResult> {
  const rewrittenText = await callOpenAIForRewrite(input);
  const diffHunks = generateDiffHunks(
    input.sectionName,
    input.originalText,
    rewrittenText
  );

  const db = getDb();
  const [insertedRow] = await db
    .insert(resumeSectionRewrites)
    .values({
      variantId: input.variantId,
      sectionName: input.sectionName,
      originalText: input.originalText,
      rewrittenText,
      appliedAt: null,
    })
    .returning();

  if (!insertedRow) {
    throw new Error("Failed to persist section rewrite");
  }

  return {
    sectionRewriteId: insertedRow.id,
    rewrittenText,
    diffHunks,
  };
}

export async function applyRewrite(sectionRewriteId: string): Promise<void> {
  const db = getDb();

  const [rewrite] = await db
    .select()
    .from(resumeSectionRewrites)
    .where(eq(resumeSectionRewrites.id, sectionRewriteId))
    .limit(1);

  if (!rewrite) {
    throw new Error(`Section rewrite not found: ${sectionRewriteId}`);
  }

  await db
    .update(resumeSectionRewrites)
    .set({ appliedAt: new Date() })
    .where(eq(resumeSectionRewrites.id, sectionRewriteId));

  const [variant] = await db
    .select()
    .from(resumeVariants)
    .where(eq(resumeVariants.id, rewrite.variantId))
    .limit(1);

  if (!variant) {
    throw new Error(`Resume variant not found: ${rewrite.variantId}`);
  }

  const updatedContent = applyRewrittenSection(
    variant.generatedContent,
    rewrite.sectionName,
    rewrite.rewrittenText
  );

  await db
    .update(resumeVariants)
    .set({ generatedContent: updatedContent })
    .where(eq(resumeVariants.id, rewrite.variantId));
}
