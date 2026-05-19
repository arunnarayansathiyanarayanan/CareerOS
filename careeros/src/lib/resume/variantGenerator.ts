import OpenAI from "openai";
import { z } from "zod";

import { getDb } from "@/db";
import { resumeVariants } from "@/db/schema/resume";
import { scoreVariantATS } from "@/lib/resume/atsScorer";
import {
  ParsedResumeSchema,
  type GeneratedVariantContent,
  type ParsedResume,
  type ResumeAngle,
  type TargetRole,
} from "@/lib/resume/types";

const VARIANT_SYSTEM_PROMPT =
  "You are a senior career strategist specializing in AI-native roles in India. You rewrite resumes to position professionals for AI PM and AI Generalist roles. You NEVER fabricate facts. Every rewrite uses only information from the provided resume JSON. Write in clear, action-verb-led, quantified language.";

const GENERATED_VARIANT_JSON_SCHEMA = `{
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
  "certifications": [{ "name": string, "issuer": string | null, "year": string | null }],
  "careerOsLink": string,
  "featuredProjects": string[]
}`;

const GeneratedVariantContentSchema = ParsedResumeSchema.extend({
  careerOsLink: z.string(),
  featuredProjects: z.array(z.string()),
});

const ANGLES: {
  angle: ResumeAngle;
  label: string;
  description: string;
}[] = [
  {
    angle: "ENGINEER_TO_PM",
    label: "Engineer → PM",
    description:
      "Frame technical depth as PM leverage. Lead with systems thinking, cross-functional delivery, and AI product intuition.",
  },
  {
    angle: "DOMAIN_EXPERT_AI",
    label: "Domain Expert + AI",
    description:
      "Frame prior domain expertise as unfair advantage in AI roles. Position AI skills as a multiplier on deep industry knowledge.",
  },
  {
    angle: "GENERALIST_BUILDER",
    label: "Generalist Builder",
    description:
      "Frame breadth and shipping velocity as the signal. Emphasize AI tools used, workflows built, and outcomes produced.",
  },
];

export interface VariantGeneratorInput {
  parsedResume: ParsedResume;
  resumeVersionId: string;
  targetRole: TargetRole;
  jobDescription?: string;
  careerOsProfileUrl: string;
  topProjectUrls: string[];
}

function stripJsonFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "");
  }
  return text.trim();
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

function buildVariantUserPrompt(
  input: VariantGeneratorInput,
  label: string,
  description: string
): string {
  const featuredProjects = input.topProjectUrls.slice(0, 3).join(", ");

  return `Target role: ${input.targetRole}
Positioning angle: ${label} — ${description}
Job description: ${input.jobDescription?.trim() || "Not provided"}
Aihired profile URL: ${input.careerOsProfileUrl}
Featured project URLs: ${featuredProjects || "None provided"}

Source resume (JSON):
${JSON.stringify(input.parsedResume)}

Rewrite this resume for the target role using the positioning angle above. Use ONLY facts present in the source resume JSON. Never add companies, titles, dates, or metrics not in the original.

Return ONLY valid JSON matching this shape exactly:
${GENERATED_VARIANT_JSON_SCHEMA}

Set careerOsLink to the Aihired profile URL and featuredProjects to the featured project URLs listed above.`;
}

async function callOpenAIForAngle(
  client: OpenAI,
  input: VariantGeneratorInput,
  label: string,
  description: string,
  angle: ResumeAngle
): Promise<string> {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VARIANT_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildVariantUserPrompt(input, label, description),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      throw new Error("OpenAI returned empty content");
    }

    return content;
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown OpenAI error";
    throw new Error(
      `Failed to generate resume variant for angle ${angle} (${label}): ${detail}`,
      { cause: error }
    );
  }
}

function parseGeneratedVariant(
  raw: string,
  angle: ResumeAngle,
  label: string,
  careerOsProfileUrl: string,
  topProjectUrls: string[]
): GeneratedVariantContent {
  try {
    const parsed: unknown = JSON.parse(stripJsonFences(raw));
    const validated = GeneratedVariantContentSchema.parse(parsed);

    return {
      ...validated,
      careerOsLink: careerOsProfileUrl,
      featuredProjects: topProjectUrls.slice(0, 3),
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Invalid JSON response";
    throw new Error(
      `Failed to parse resume variant for angle ${angle} (${label}): ${detail}`,
      { cause: error }
    );
  }
}

export async function generateVariants(
  input: VariantGeneratorInput
): Promise<(typeof resumeVariants.$inferSelect)[]> {
  const client = getOpenAIClient();
  const db = getDb();
  const featuredProjects = input.topProjectUrls.slice(0, 3);

  const rawResponses = await Promise.all(
    ANGLES.map(({ angle, label, description }) =>
      callOpenAIForAngle(client, input, label, description, angle)
    )
  );

  const inserted = await Promise.all(
    ANGLES.map(async ({ angle, label, description }, index) => {
      const generatedContent = parseGeneratedVariant(
        rawResponses[index]!,
        angle,
        label,
        input.careerOsProfileUrl,
        featuredProjects
      );

      const { score, breakdown } = scoreVariantATS(
        generatedContent,
        input.targetRole,
        input.jobDescription
      );

      const [row] = await db
        .insert(resumeVariants)
        .values({
          resumeVersionId: input.resumeVersionId,
          angle,
          generatedContent,
          atsScore: Math.round(score),
          atsBreakdown: breakdown,
        })
        .returning();

      if (!row) {
        throw new Error(
          `Failed to persist resume variant for angle ${angle} (${label})`
        );
      }

      return row;
    })
  );

  return inserted;
}
