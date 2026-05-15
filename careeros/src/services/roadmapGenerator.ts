import OpenAI, {
  APIConnectionTimeoutError,
  APIUserAbortError,
} from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getOpenAiModel } from "@/lib/openaiModel";

const ROADMAP_PROMPT_VERSION = "v1";
const ROADMAP_OPENAI_TIMEOUT_MS = 25_000;
const MAX_TOKENS = 4000;

const ROADMAP_SYSTEM_PROMPT =
  "You are CareerOS's AI roadmap engine. Generate a personalized, opinionated AI career roadmap.\n" +
  "You output ONLY valid JSON. No markdown. No explanation. No preamble.\n" +
  "Every item must be actionable. Every project must be buildable in 1-2 weeks solo.\n" +
  "Curate only real, freely available content (YouTube, official docs, blogs).";

const ROADMAP_USER_SCHEMA_BLOCK = `Return JSON with this exact schema:
{
  meta: {
    targetRole: string,
    aiNativeReadyScore: number,      // 0-100, initial estimate
    estimatedWeeksToReady: number,
    phase: 'foundation' | 'building' | 'shipping'
  },
  phases: [
    {
      name: string,
      description: string,
      items: [
        {
          id: string,               // uuid-style slug
          type: 'concept' | 'project' | 'milestone',
          title: string,
          description: string,
          estimatedHours: number,
          difficulty: 1 | 2 | 3 | 4 | 5,
          dependencies: string[],   // item ids
          status: 'not_started',

          // if type === 'concept':
          resources: [{ title: string, url: string, type: 'youtube'|'blog'|'docs' }],

          // if type === 'project':
          problemStatement: string,
          techStack: string[],
          successCriteria: string[],
          evidenceChecklist: string[],   // ['deployed link', 'github repo', 'loom demo', 'write-up']

          // if type === 'milestone':
          deliverable: string,
          sharePrompt: string        // suggested LinkedIn post angle
        }
      ]
    }
  ]
}`;

export interface ResumeParsedExperience {
  company?: string;
  title?: string;
  duration?: string;
  bullets?: string[];
}

export interface ResumeParsed {
  skills?: string[];
  experience?: ResumeParsedExperience[];
}

export interface OnboardingProfile {
  /** \`users.id\` (UUID) */
  userId: string;
  /** \`onboarding_profiles.id\` (UUID) */
  onboardingProfileId: string;
  targetRole: string;
  currentRole?: string | null;
  yearsOfExperience?: string | number | null;
  aiFluency: string;
  resumeParsed?: ResumeParsed | null;
}

export interface Roadmap {
  id: string;
  userId: string;
  onboardingProfileId: string;
  version: number;
  content: RoadmapContent;
  generatedAt: string;
  isCurrent: boolean;
  generationModel: string | null;
  generationPromptVersion: string | null;
}

const difficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const phaseSchema = z.enum(["foundation", "building", "shipping"]);

const resourceSchema = z.object({
  title: z.string(),
  url: z.string().min(1),
  type: z.enum(["youtube", "blog", "docs"]),
});

const roadmapItemSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("concept"),
    title: z.string(),
    description: z.string(),
    estimatedHours: z.number().nonnegative(),
    difficulty: difficultySchema,
    dependencies: z.array(z.string()),
    status: z.literal("not_started"),
    resources: z.array(resourceSchema).min(1),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("project"),
    title: z.string(),
    description: z.string(),
    estimatedHours: z.number().nonnegative(),
    difficulty: difficultySchema,
    dependencies: z.array(z.string()),
    status: z.literal("not_started"),
    problemStatement: z.string().min(1),
    techStack: z.array(z.string()).min(1),
    successCriteria: z.array(z.string()).min(1),
    evidenceChecklist: z.array(z.string()).min(1),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("milestone"),
    title: z.string(),
    description: z.string(),
    estimatedHours: z.number().nonnegative(),
    difficulty: difficultySchema,
    dependencies: z.array(z.string()),
    status: z.literal("not_started"),
    deliverable: z.string().min(1),
    sharePrompt: z.string().min(1),
  }),
]);

const roadmapContentSchema = z.object({
  meta: z.object({
    targetRole: z.string(),
    aiNativeReadyScore: z.number().int().min(0).max(100),
    estimatedWeeksToReady: z.number().nonnegative(),
    phase: phaseSchema,
  }),
  phases: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        items: z.array(roadmapItemSchema).min(1),
      })
    )
    .min(1),
});

export type RoadmapContent = z.infer<typeof roadmapContentSchema>;
export type RoadmapItem = z.infer<typeof roadmapItemSchema>;

const AI_GENERALIST_STARTER_TEMPLATE: RoadmapContent = {
  meta: {
    targetRole: "AI Generalist",
    aiNativeReadyScore: 35,
    estimatedWeeksToReady: 12,
    phase: "foundation",
  },
  phases: [
    {
      name: "Foundation (Days 1–30)",
      description:
        "Build intuition for how modern LLM apps work end-to-end: APIs, prompts, evaluation, and a tiny shipped artifact.",
      items: [
        {
          id: "starter-concept-llm-apis",
          type: "concept",
          title: "LLM APIs and request/response shapes",
          description:
            "Understand messages, roles, tokens, temperature, and structured outputs so you can debug real integrations.",
          estimatedHours: 6,
          difficulty: 2,
          dependencies: [],
          status: "not_started",
          resources: [
            {
              title: "OpenAI API quickstart",
              url: "https://platform.openai.com/docs/quickstart",
              type: "docs",
            },
            {
              title: "OpenAI Chat Completions reference",
              url: "https://platform.openai.com/docs/api-reference/chat/create",
              type: "docs",
            },
          ],
        },
        {
          id: "starter-concept-prompting",
          type: "concept",
          title: "Prompting for reliability",
          description:
            "Learn patterns for instructions, examples, constraints, and self-checks that reduce brittle behavior.",
          estimatedHours: 5,
          difficulty: 2,
          dependencies: ["starter-concept-llm-apis"],
          status: "not_started",
          resources: [
            {
              title: "OpenAI prompt engineering guide",
              url: "https://platform.openai.com/docs/guides/prompt-engineering",
              type: "docs",
            },
            {
              title: "Google AI prompting guide",
              url: "https://ai.google.dev/gemini-api/docs/prompting-strategies",
              type: "docs",
            },
          ],
        },
        {
          id: "starter-project-cli-assistant",
          type: "project",
          title: "CLI research assistant",
          description:
            "A small command-line tool that takes a topic, calls an LLM with citations-style summaries, and prints markdown.",
          estimatedHours: 18,
          difficulty: 3,
          dependencies: ["starter-concept-prompting"],
          status: "not_started",
          problemStatement:
            "You need a repeatable way to summarize technical topics with consistent structure and guardrails.",
          techStack: ["TypeScript", "OpenAI SDK", "dotenv"],
          successCriteria: [
            "Accepts a topic string and optional depth flag",
            "Uses environment variables for API keys",
            "Outputs stable markdown sections (summary, steps, risks)",
          ],
          evidenceChecklist: [
            "GitHub repo",
            "README with setup steps",
            "Short Loom demo",
          ],
        },
        {
          id: "starter-milestone-foundation",
          type: "milestone",
          title: "Ship your first AI-sidecar tool",
          description:
            "You should have one working integration and one public artifact you can talk about in interviews.",
          estimatedHours: 2,
          difficulty: 1,
          dependencies: ["starter-project-cli-assistant"],
          status: "not_started",
          deliverable:
            "Public repo + 2-minute demo showing the tool on a real question you care about.",
          sharePrompt:
            "What I built: a tiny CLI assistant that turns messy research into structured notes — here’s what I learned about prompts, errors, and API limits.",
        },
      ],
    },
    {
      name: "Building (Days 31–60)",
      description:
        "Move from single-shot calls to retrieval, evaluation, and a user-facing mini-product.",
      items: [
        {
          id: "starter-concept-rag",
          type: "concept",
          title: "Retrieval-augmented generation (RAG)",
          description:
            "Chunking, embeddings, vector search, and grounding so answers cite your own documents.",
          estimatedHours: 8,
          difficulty: 3,
          dependencies: ["starter-milestone-foundation"],
          status: "not_started",
          resources: [
            {
              title: "LangChain RAG conceptual overview",
              url: "https://python.langchain.com/docs/concepts/rag/",
              type: "docs",
            },
            {
              title: "OpenAI embeddings guide",
              url: "https://platform.openai.com/docs/guides/embeddings",
              type: "docs",
            },
          ],
        },
        {
          id: "starter-project-rag-notebook",
          type: "project",
          title: "Notebook QA over your own PDFs",
          description:
            "Upload PDFs, index chunks, and answer questions with citations back to page ranges.",
          estimatedHours: 22,
          difficulty: 4,
          dependencies: ["starter-concept-rag"],
          status: "not_started",
          problemStatement:
            "You want grounded answers over private documents with measurable retrieval quality.",
          techStack: ["Python or TypeScript", "Embeddings API", "Vector store (local or hosted)"],
          successCriteria: [
            "Ingest at least 3 PDFs",
            "Return answers with chunk citations",
            "Log latency and token usage per query",
          ],
          evidenceChecklist: ["GitHub repo", "write-up", "deployed link (optional)"],
        },
        {
          id: "starter-milestone-rag",
          type: "milestone",
          title: "Demonstrate grounded answers",
          description: "Prove you can ship RAG with basic eval hooks, not just a demo happy-path.",
          estimatedHours: 2,
          difficulty: 2,
          dependencies: ["starter-project-rag-notebook"],
          status: "not_started",
          deliverable: "Repo + mini eval sheet (10 questions) + 1 failure analysis write-up.",
          sharePrompt:
            "RAG isn’t magic — here’s how my notebook QA fails, what I measured, and the two changes that helped most.",
        },
      ],
    },
    {
      name: "Shipping (Days 61–90)",
      description:
        "Hardening: UX, safety basics, deployment, and a portfolio narrative that reads like a product story.",
      items: [
        {
          id: "starter-concept-eval-safety",
          type: "concept",
          title: "Lightweight evals and safety basics",
          description:
            "Golden tests, regression checks, and simple guardrails for PII/unsafe outputs in user-facing flows.",
          estimatedHours: 7,
          difficulty: 3,
          dependencies: ["starter-milestone-rag"],
          status: "not_started",
          resources: [
            {
              title: "OpenAI moderation guide",
              url: "https://platform.openai.com/docs/guides/moderation",
              type: "docs",
            },
            {
              title: "OpenAI evaluation guides",
              url: "https://platform.openai.com/docs/guides/evaluation",
              type: "docs",
            },
          ],
        },
        {
          id: "starter-project-mini-web-app",
          type: "project",
          title: "Deploy a minimal web UI for your RAG flow",
          description:
            "A small authenticated or local-only UI with streaming responses and basic error states.",
          estimatedHours: 24,
          difficulty: 4,
          dependencies: ["starter-concept-eval-safety"],
          status: "not_started",
          problemStatement:
            "Turn your working backend into something others can try, with acceptable UX and observability.",
          techStack: ["Next.js or FastAPI", "Hosting (Vercel/Fly/Render)", "Env secrets"],
          successCriteria: [
            "One deployed URL or reproducible local compose",
            "Streaming or clear loading states",
            "Basic logging for errors",
          ],
          evidenceChecklist: ["deployed link", "GitHub repo", "Loom demo", "write-up"],
        },
        {
          id: "starter-milestone-ship",
          type: "milestone",
          title: "90-day portfolio checkpoint",
          description: "Package what you shipped into a crisp narrative recruiters can scan in 60 seconds.",
          estimatedHours: 3,
          difficulty: 2,
          dependencies: ["starter-project-mini-web-app"],
          status: "not_started",
          deliverable:
            "One-page case study: problem, constraints, architecture, metrics, failures, next steps.",
          sharePrompt:
            "90 days into AI engineering: two shipped projects, what I’d redo, and the skills I’m doubling down on next.",
        },
      ],
    },
  ],
};

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

function formatTargetRoleLabel(targetRole: string): string {
  return targetRole
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function buildFallbackContent(profile: OnboardingProfile): RoadmapContent {
  const base = structuredClone(AI_GENERALIST_STARTER_TEMPLATE);
  base.meta.targetRole = formatTargetRoleLabel(profile.targetRole);
  return base;
}

function parseModelJson(raw: string): unknown {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "");
  }
  return JSON.parse(t) as unknown;
}

function parseAndValidateRoadmapContent(raw: string): RoadmapContent | null {
  let parsed: unknown;
  try {
    parsed = parseModelJson(raw);
  } catch {
    return null;
  }
  const result = roadmapContentSchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }
  return result.data;
}

function resumeSkillsList(resume: ResumeParsed): string[] {
  const skills = resume.skills;
  if (!Array.isArray(skills)) return [];
  return skills.filter((s): s is string => typeof s === "string");
}

function buildUserPrompt(profile: OnboardingProfile): string {
  const years =
    profile.yearsOfExperience === null || profile.yearsOfExperience === undefined
      ? "Not specified"
      : String(profile.yearsOfExperience);

  const resumeContext = profile.resumeParsed
    ? "- Resume: structured resume signals are included after the schema block."
    : "";

  let prompt = `Generate a 90-day personalized AI career roadmap for:
- Target Role: ${profile.targetRole}
- Current Role: ${profile.currentRole || "Not specified"}
- Experience: ${years} years
- AI Fluency: ${profile.aiFluency}
${resumeContext ? `${resumeContext}\n` : ""}

${ROADMAP_USER_SCHEMA_BLOCK}`;

  if (profile.resumeParsed) {
    const skills = resumeSkillsList(profile.resumeParsed);
    const ex0 = profile.resumeParsed.experience?.[0];
    prompt += `

The user's resume shows:
- Current skills: ${skills.join(", ")}
- Most recent role: ${ex0?.title ?? "Not specified"} at ${ex0?.company ?? "Not specified"}
Leverage their existing strengths. Skip concepts they already clearly know. Accelerate into gaps.`;
  }

  return prompt;
}

async function callOpenAiRoadmapRawText(
  profile: OnboardingProfile,
  timeoutMs: number | null
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("MISSING_OPENAI_API_KEY");
  }

  const model = getOpenAiModel();
  const client = new OpenAI({ apiKey });
  const controller = new AbortController();
  const timer =
    timeoutMs != null
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  try {
    const completion = await client.chat.completions.create(
      {
        model,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ROADMAP_SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(profile) },
        ],
      },
      { signal: controller.signal }
    );
    return completion.choices[0]?.message?.content?.trim() ?? "";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function assertProfile(profile: OnboardingProfile): void {
  if (!profile.userId?.trim()) {
    throw new Error("OnboardingProfile.userId is required");
  }
  if (!profile.onboardingProfileId?.trim()) {
    throw new Error("OnboardingProfile.onboardingProfileId is required");
  }
  if (!profile.targetRole?.trim()) {
    throw new Error("OnboardingProfile.targetRole is required");
  }
  if (!profile.aiFluency?.trim()) {
    throw new Error("OnboardingProfile.aiFluency is required");
  }
}

function mapRoadmapRow(row: {
  id: string;
  user_id: string;
  onboarding_profile_id: string;
  version: number;
  content: unknown;
  generated_at: string;
  is_current: boolean;
  generation_model: string | null;
  generation_prompt_version: string | null;
}): Roadmap {
  const contentResult = roadmapContentSchema.safeParse(row.content);
  const content = contentResult.success
    ? contentResult.data
    : buildFallbackContent({
        userId: row.user_id,
        onboardingProfileId: row.onboarding_profile_id,
        targetRole: "ai_generalist",
        aiFluency: "not_started",
      });

  return {
    id: row.id,
    userId: row.user_id,
    onboardingProfileId: row.onboarding_profile_id,
    version: row.version,
    content,
    generatedAt: row.generated_at,
    isCurrent: row.is_current,
    generationModel: row.generation_model,
    generationPromptVersion: row.generation_prompt_version,
  };
}

async function nextRoadmapVersion(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("roadmaps")
    .select("version")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const max = data?.version;
  return typeof max === "number" ? max + 1 : 1;
}

async function insertCurrentRoadmap(
  supabase: SupabaseClient,
  profile: OnboardingProfile,
  content: RoadmapContent,
  generationModel: string | null
): Promise<Roadmap> {
  const version = await nextRoadmapVersion(supabase, profile.userId);

  const { error: clearError } = await supabase
    .from("roadmaps")
    .update({ is_current: false })
    .eq("user_id", profile.userId)
    .eq("is_current", true);

  if (clearError) throw clearError;

  const { data: inserted, error: insertError } = await supabase
    .from("roadmaps")
    .insert({
      user_id: profile.userId,
      onboarding_profile_id: profile.onboardingProfileId,
      version,
      content,
      is_current: true,
      generation_model: generationModel,
      generation_prompt_version: ROADMAP_PROMPT_VERSION,
    })
    .select(
      "id, user_id, onboarding_profile_id, version, content, generated_at, is_current, generation_model, generation_prompt_version"
    )
    .single();

  if (insertError) throw insertError;
  if (!inserted) throw new Error("Roadmap insert returned no row");

  return mapRoadmapRow(
    inserted as {
      id: string;
      user_id: string;
      onboarding_profile_id: string;
      version: number;
      content: unknown;
      generated_at: string;
      is_current: boolean;
      generation_model: string | null;
      generation_prompt_version: string | null;
    }
  );
}

function wasTimedOut(error: unknown): boolean {
  if (error instanceof APIUserAbortError) return true;
  if (error instanceof APIConnectionTimeoutError) return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error instanceof Error && error.message.toLowerCase().includes("abort")) {
    return true;
  }
  return false;
}

function scheduleBackgroundOpenAiRetry(profile: OnboardingProfile): void {
  void (async () => {
    try {
      const raw = await callOpenAiRoadmapRawText(profile, null);
      const content = parseAndValidateRoadmapContent(raw);
      if (!content) return;

      const supabase = getSupabaseAdmin();
      await insertCurrentRoadmap(
        supabase,
        profile,
        content,
        getOpenAiModel()
      );
    } catch (e) {
      console.error("[roadmapGenerator] background OpenAI retry failed:", e);
    }
  })();
}

/**
 * Generates an initial roadmap via OpenAI, validates JSON, persists to \`roadmaps\`,
 * and marks the new row \`is_current = true\` (previous rows for the user unset).
 * On OpenAI timeout: returns the AI Generalist starter template immediately and
 * retries generation in the background; a successful retry inserts a new current roadmap.
 */
export async function generateInitialRoadmap(
  profile: OnboardingProfile
): Promise<Roadmap> {
  assertProfile(profile);
  const supabase = getSupabaseAdmin();

  let content: RoadmapContent;
  let generationModel: string | null = getOpenAiModel();
  let timedOut = false;

  try {
    const raw = await callOpenAiRoadmapRawText(
      profile,
      ROADMAP_OPENAI_TIMEOUT_MS
    );
    const parsed = parseAndValidateRoadmapContent(raw);
    if (parsed) {
      content = parsed;
    } else {
      content = buildFallbackContent(profile);
      generationModel = null;
    }
  } catch (e) {
    if (wasTimedOut(e)) {
      timedOut = true;
      content = buildFallbackContent(profile);
      generationModel = null;
    } else {
      console.error("[roadmapGenerator] OpenAI request failed:", e);
      content = buildFallbackContent(profile);
      generationModel = null;
    }
  }

  const roadmap = await insertCurrentRoadmap(
    supabase,
    profile,
    content,
    generationModel
  );

  if (timedOut) {
    scheduleBackgroundOpenAiRetry(profile);
  }

  return roadmap;
}
