import OpenAI, {
  APIConnectionTimeoutError,
  APIUserAbortError,
} from "openai";
import { z } from "zod";

import type {
  CompletionChecklist,
  ExternalLink,
} from "@/db/schema/roadmap";
import type {
  GenerateRoadmapInput,
  RoadmapGenerationResult,
  TargetRole,
} from "@/types/roadmap";
import { RoadmapGenerationError } from "@/types/roadmap";

const MODEL = "gpt-4o";
const MAX_TOKENS = 4000;
const TEMPERATURE = 0.3;
const TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `You are an expert AI career architect for CareerOS. You design personalized, 
opinionated learning + building roadmaps for professionals transitioning into 
AI-native roles in the Indian job market.

Output ONLY valid JSON. No prose, no markdown. Follow the schema exactly.`;

const JSON_SCHEMA_BLOCK = `{
  phases: [{
    name: string,
    phaseOrder: number,
    items: [{
      type: 'concept'|'project'|'milestone',
      title: string,
      description: string,
      estimatedHours: number,
      difficulty: number,
      phase: string,
      phaseOrder: number,
      itemOrder: number,
      techStack: string[],
      externalLinks: [{ label: string, url: string, type: 'youtube'|'blog'|'docs' }],
      completionChecklist: {
        deployedLink: boolean,
        githubRepo: boolean,
        loomDemo: boolean,
        writeUp: boolean
      },
      proofOfWorkUrl: null,
      status: 'not_started'
    }]
  }]
}`;

const PHASE_NAMES_BY_ROLE: Record<TargetRole, string[]> = {
  AI_PM: [
    "AI Fluency",
    "AI Workflows",
    "AI Product Thinking",
    "AI Interviews",
    "Job Ready",
  ],
  AI_GENERALIST: [
    "AI Fluency",
    "AI Tool Mastery",
    "AI Workflows",
    "Ship & Build",
    "Job Ready",
  ],
  AI_ENGINEER: [
    "Python & ML Basics",
    "Model Fine-Tuning",
    "AI Systems",
    "Deployment",
    "Job Ready",
  ],
  AI_MARKETER: [
    "AI Fluency",
    "AI for Growth",
    "Campaign Systems",
    "Portfolio & Proof",
    "Job Ready",
  ],
  AI_OPERATOR: [
    "AI Fluency",
    "Ops Automation",
    "AI Workflows",
    "Scale & Governance",
    "Job Ready",
  ],
  AI_FOUNDER: [
    "AI Fluency",
    "Problem & MVP",
    "Ship & Iterate",
    "GTM & Traction",
    "Job Ready",
  ],
};

const externalLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  type: z.enum(["youtube", "blog", "docs"]),
});

const completionChecklistSchema = z.object({
  deployedLink: z.boolean(),
  githubRepo: z.boolean(),
  loomDemo: z.boolean(),
  writeUp: z.boolean(),
});

const generatedItemSchema = z.object({
  type: z.enum(["concept", "project", "milestone"]),
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedHours: z.number().int().positive(),
  difficulty: z.number().int().min(1).max(5),
  phase: z.string().min(1),
  phaseOrder: z.number().int().positive(),
  itemOrder: z.number().int().positive(),
  techStack: z.array(z.string()),
  externalLinks: z.array(externalLinkSchema).max(3),
  completionChecklist: completionChecklistSchema.optional(),
  proofOfWorkUrl: z.null(),
  status: z.literal("not_started"),
});

const generatedPhaseSchema = z.object({
  name: z.string().min(1),
  phaseOrder: z.number().int().positive(),
  items: z.array(generatedItemSchema).min(3).max(7),
});

const generatedRoadmapSchema = z.object({
  phases: z.array(generatedPhaseSchema).min(4).max(6),
});

type GeneratedRoadmap = z.infer<typeof generatedRoadmapSchema>;

function phaseNamesForRole(targetRole: TargetRole): string[] {
  return PHASE_NAMES_BY_ROLE[targetRole];
}

function buildUserPrompt(input: GenerateRoadmapInput): string {
  const phaseNames = phaseNamesForRole(input.targetRole);
  const skills =
    input.existingSkills?.length ?
      input.existingSkills.join(", ")
    : "Not specified";

  return `Generate a personalized CareerOS learning roadmap for the Indian job market.

Profile:
- Target role: ${input.targetRole}
- Current role: ${input.currentRole}
- Years of experience: ${input.yearsExperience}
- AI fluency: ${input.aiFluency}
- Existing skills: ${skills}

Requirements:
- Produce 4-6 named phases. Use these phase names in order (adapt wording slightly only if needed for clarity): ${JSON.stringify(phaseNames)}
- Each phase has 3-7 items.
- Mix item types across the full roadmap: ~40% concept, ~40% project, ~20% milestone.
- For concept and milestone items: techStack must be [] and externalLinks may have up to 3 curated free resources (YouTube, official docs, blogs).
- For project items: include techStack, completionChecklist with all four booleans set false, externalLinks must be [].
- Every item description: 2-3 sentences, actionable, opinionated.
- Set each item's phase field to its parent phase name; phaseOrder and itemOrder must be sequential starting at 1.
- proofOfWorkUrl must be null and status must be "not_started" on every item.

Return JSON matching this schema exactly:
${JSON_SCHEMA_BLOCK}`;
}

function defaultCompletionChecklist(): CompletionChecklist {
  return {
    deployedLink: false,
    githubRepo: false,
    loomDemo: false,
    writeUp: false,
  };
}

function normalizeItem(
  raw: z.infer<typeof generatedItemSchema>,
  phaseName: string,
  phaseOrder: number
): RoadmapGenerationResult["phases"][number]["items"][number] {
  const externalLinks: ExternalLink[] =
    raw.type === "project" ? [] : raw.externalLinks;

  const techStack = raw.type === "project" ? raw.techStack : [];

  const completionChecklist: CompletionChecklist =
    raw.type === "project" ?
      (raw.completionChecklist ?? defaultCompletionChecklist())
    : {};

  return {
    type: raw.type,
    phase: phaseName || raw.phase,
    phaseOrder,
    itemOrder: raw.itemOrder,
    title: raw.title,
    description: raw.description,
    estimatedHours: raw.estimatedHours,
    difficulty: raw.difficulty,
    dependencies: [],
    status: "not_started",
    userNote: null,
    externalLinks,
    proofOfWorkUrl: null,
    techStack,
    completionChecklist,
    completedAt: null,
  };
}

function toGenerationResult(parsed: GeneratedRoadmap): RoadmapGenerationResult {
  return {
    phases: parsed.phases.map((phase) => ({
      name: phase.name,
      phaseOrder: phase.phaseOrder,
      items: phase.items.map((item) =>
        normalizeItem(item, phase.name, phase.phaseOrder)
      ),
    })),
  };
}

function isQuotaError(error: unknown): boolean {
  return error instanceof OpenAI.APIError && error.status === 429;
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof APIUserAbortError) return true;
  if (error instanceof APIConnectionTimeoutError) return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error instanceof Error && error.message.toLowerCase().includes("abort")) {
    return true;
  }
  return false;
}

function parseModelContent(raw: string): GeneratedRoadmap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new RoadmapGenerationError(
      "PARSE_FAIL",
      "Failed to parse roadmap"
    );
  }

  const result = generatedRoadmapSchema.safeParse(parsed);
  if (!result.success) {
    throw new RoadmapGenerationError(
      "PARSE_FAIL",
      "Failed to parse roadmap"
    );
  }

  return result.data;
}

export async function generateRoadmap(
  input: GenerateRoadmapInput
): Promise<RoadmapGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
      },
      { signal: controller.signal }
    );

    const content = completion.choices[0]?.message?.content;
    if (!content?.trim()) {
      throw new RoadmapGenerationError(
        "PARSE_FAIL",
        "Failed to parse roadmap"
      );
    }

    const generated = parseModelContent(content);
    return toGenerationResult(generated);
  } catch (error) {
    if (error instanceof RoadmapGenerationError) throw error;
    if (isTimeoutError(error)) {
      throw new RoadmapGenerationError("TIMEOUT", "Generation timed out");
    }
    if (isQuotaError(error)) {
      throw new RoadmapGenerationError("QUOTA", "Quota exceeded");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
