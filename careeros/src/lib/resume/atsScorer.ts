import type {
  ATSBreakdown,
  GeneratedVariantContent,
  TargetRole,
} from "./types";

export const TARGET_ROLE_KEYWORDS: Record<TargetRole, string[]> = {
  AI_PM: [
    "product strategy",
    "LLM",
    "RAG",
    "roadmap",
    "stakeholder",
    "AI system design",
    "prioritization",
    "PRD",
    "go-to-market",
    "user research",
    "A/B testing",
    "prompt engineering",
    "GPT",
    "fine-tuning",
    "AI roadmap",
    "tradeoffs",
    "OKR",
    "north star metric",
    "discovery",
    "delivery",
  ],
  AI_GENERALIST: [
    "automation",
    "n8n",
    "Zapier",
    "Make",
    "AI workflow",
    "LangChain",
    "prompt engineering",
    "GPT",
    "no-code",
    "API integration",
    "LLM",
    "RAG",
    "vector database",
    "AI agent",
    "ChatGPT",
    "Notion AI",
    "AI tools",
    "workflow design",
    "process automation",
    "output",
  ],
  AI_ENGINEER: [
    "LangChain",
    "LangGraph",
    "RAG",
    "Pinecone",
    "Weaviate",
    "fine-tuning",
    "embeddings",
    "Hugging Face",
    "FastAPI",
    "Python",
    "LLM",
    "AI agent",
    "MLOps",
    "model deployment",
    "vector DB",
    "semantic search",
    "RLHF",
    "LoRA",
    "CrewAI",
    "inference",
  ],
  AI_MARKETER: [
    "AI content",
    "growth",
    "SEO",
    "performance marketing",
    "AI tools",
    "automation",
    "copywriting",
    "analytics",
    "campaign",
    "funnel",
    "LLM",
    "prompt engineering",
    "personalization",
    "AI-driven",
    "content strategy",
    "demand generation",
    "conversion",
    "CRO",
    "attribution",
    "GTM",
  ],
  AI_OPERATOR: [
    "process automation",
    "n8n",
    "Zapier",
    "SOPs",
    "workflow",
    "AI tools",
    "operations",
    "efficiency",
    "cost reduction",
    "cross-functional",
    "AI integration",
    "documentation",
    "project management",
    "stakeholder",
    "OKR",
    "process design",
    "change management",
    "tooling",
    "systems thinking",
    "delivery",
  ],
  AI_FOUNDER: [
    "product",
    "fundraising",
    "GTM",
    "AI strategy",
    "team building",
    "roadmap",
    "traction",
    "revenue",
    "B2B",
    "SaaS",
    "LLM",
    "AI product",
    "startup",
    "vision",
    "execution",
    "pitch",
    "investor",
    "PMF",
    "unit economics",
    "growth",
  ],
};

const ACTION_VERBS = [
  "built",
  "launched",
  "led",
  "designed",
  "shipped",
  "optimized",
  "automated",
  "reduced",
  "increased",
  "delivered",
  "managed",
  "defined",
  "architected",
  "deployed",
  "integrated",
  "created",
  "developed",
  "implemented",
  "streamlined",
  "generated",
  "drove",
  "scaled",
  "owned",
  "spearheaded",
  "established",
  "negotiated",
  "mentored",
  "coordinated",
  "executed",
  "produced",
];

const AI_DEPTH_TERMS = [
  "LLM",
  "GPT",
  "RAG",
  "vector",
  "embedding",
  "fine-tuning",
  "prompt engineering",
  "LangChain",
  "LangGraph",
  "CrewAI",
  "AI agent",
  "OpenAI",
  "n8n",
  "Zapier AI",
  "Pinecone",
  "Weaviate",
  "Hugging Face",
  "Claude",
  "Gemini",
  "multimodal",
  "RLHF",
  "LoRA",
  "semantic search",
  "function calling",
  "AI workflow",
];

const QUANTIFIED_IMPACT_REGEX =
  /\d+%|\d+x|\$\d+|₹\d+|\d+\s?(hours|days|users|requests|leads|customers|teams|countries)/i;

function variantText(variant: GeneratedVariantContent): string {
  return JSON.stringify(variant).toLowerCase();
}

function collectBullets(variant: GeneratedVariantContent): string[] {
  return variant.experience.flatMap((entry) => entry.bullets);
}

function buildKeywordSet(
  targetRole: TargetRole,
  jobDescription?: string
): string[] {
  const keywords = [...TARGET_ROLE_KEYWORDS[targetRole]];

  if (jobDescription) {
    const tokens = jobDescription
      .split(/\s+/)
      .map((token) => token.toLowerCase())
      .filter((token) => token.length >= 4);
    keywords.push(...tokens);
  }

  return [...new Set(keywords.map((kw) => kw.toLowerCase()))];
}

function scoreKeywordMatch(
  text: string,
  keywords: string[]
): number {
  if (keywords.length === 0) return 0;

  const matched = keywords.filter((kw) => text.includes(kw)).length;
  return Math.min(25, (matched / keywords.length) * 25);
}

function scoreFormatting(variant: GeneratedVariantContent): number {
  let score = 0;

  if (variant.summary && variant.summary.length > 0) {
    score += 5;
  }
  if (variant.experience.length >= 2) {
    score += 5;
  }
  if (variant.experience.every((entry) => entry.bullets.length >= 3)) {
    score += 5;
  }
  if (variant.skills.length >= 8) {
    score += 5;
  }

  return score;
}

function scoreActionVerbDensity(bullets: string[]): number {
  if (bullets.length === 0) return 0;

  const matchingBullets = bullets.filter((bullet) => {
    const lower = bullet.toLowerCase();
    return ACTION_VERBS.some((verb) => lower.includes(verb));
  }).length;

  return Math.min(20, (matchingBullets / bullets.length) * 20);
}

function scoreQuantifiedImpactRatio(bullets: string[]): number {
  if (bullets.length === 0) return 0;

  const quantifiedBullets = bullets.filter((bullet) =>
    QUANTIFIED_IMPACT_REGEX.test(bullet)
  ).length;

  return Math.min(20, (quantifiedBullets / bullets.length) * 20);
}

function scoreAiDepthSignal(text: string): number {
  const matchedTerms = AI_DEPTH_TERMS.filter((term) =>
    text.includes(term.toLowerCase())
  ).length;

  return Math.min(15, matchedTerms * 3);
}

export function scoreVariantATS(
  variant: GeneratedVariantContent,
  targetRole: TargetRole,
  jobDescription?: string
): { score: number; breakdown: ATSBreakdown } {
  const text = variantText(variant);
  const keywords = buildKeywordSet(targetRole, jobDescription);
  const bullets = collectBullets(variant);

  const keywordMatch = scoreKeywordMatch(text, keywords);
  const formattingScore = scoreFormatting(variant);
  const actionVerbDensity = scoreActionVerbDensity(bullets);
  const quantifiedImpactRatio = scoreQuantifiedImpactRatio(bullets);
  const aiDepthSignal = scoreAiDepthSignal(text);

  const breakdown: ATSBreakdown = {
    keywordMatch,
    formattingScore,
    actionVerbDensity,
    quantifiedImpactRatio,
    aiDepthSignal,
  };

  const score =
    keywordMatch +
    formattingScore +
    actionVerbDensity +
    quantifiedImpactRatio +
    aiDepthSignal;

  return { score, breakdown };
}
