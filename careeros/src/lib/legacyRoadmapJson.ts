import { z } from "zod";

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

function formatTargetRoleLabel(targetRole: string): string {
  return targetRole
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Opinionated starter template when OpenAI output is missing or invalid. */
export function buildStarterRoadmapContentForRole(targetRole: string): RoadmapContent {
  const base = structuredClone(AI_GENERALIST_STARTER_TEMPLATE);
  base.meta.targetRole = formatTargetRoleLabel(targetRole);
  return base;
}
