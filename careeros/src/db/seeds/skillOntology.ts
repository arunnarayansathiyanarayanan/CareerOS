import { getDb } from "@/db/client";
import {
  skillOntology,
  type SkillOntologyCategory,
} from "@/db/schema/skillIntelligence";

type SkillSeed = {
  name: string;
  slug: string;
  category: SkillOntologyCategory;
  aliases: string[];
};

const CANONICAL_AI_SKILLS: SkillSeed[] = [
  // infra
  {
    name: "PostgreSQL",
    slug: "postgresql",
    category: "infra",
    aliases: ["postgres", "psql", "pg database"],
  },
  {
    name: "Redis",
    slug: "redis",
    category: "infra",
    aliases: ["redis cache", "redis queue", "in-memory cache"],
  },
  {
    name: "Pinecone",
    slug: "pinecone",
    category: "infra",
    aliases: ["pinecone vector db", "pinecone index"],
  },
  {
    name: "Weaviate",
    slug: "weaviate",
    category: "infra",
    aliases: ["weaviate vector database", "weaviate db"],
  },
  {
    name: "Supabase",
    slug: "supabase",
    category: "infra",
    aliases: ["supabase db", "supabase backend", "supabase postgres"],
  },
  {
    name: "Docker",
    slug: "docker",
    category: "infra",
    aliases: ["docker containers", "containerization", "docker compose"],
  },
  {
    name: "Kubernetes",
    slug: "kubernetes",
    category: "infra",
    aliases: ["k8s", "kubernetes orchestration", "k8s cluster"],
  },
  {
    name: "AWS",
    slug: "aws",
    category: "infra",
    aliases: ["amazon web services", "amazon aws", "aws cloud"],
  },
  {
    name: "GCP",
    slug: "gcp",
    category: "infra",
    aliases: ["google cloud platform", "google cloud", "gcp cloud"],
  },
  {
    name: "Vercel",
    slug: "vercel",
    category: "infra",
    aliases: ["vercel deployment", "vercel hosting", "vercel platform"],
  },
  {
    name: "Cloudflare Workers",
    slug: "cloudflare-workers",
    category: "infra",
    aliases: ["cloudflare workers", "cf workers", "workers edge"],
  },
  {
    name: "Terraform",
    slug: "terraform",
    category: "infra",
    aliases: ["terraform iac", "hashicorp terraform", "infrastructure as code"],
  },
  {
    name: "Neon",
    slug: "neon",
    category: "infra",
    aliases: ["neon postgres", "neon database", "neon serverless postgres"],
  },
  {
    name: "Kafka",
    slug: "kafka",
    category: "infra",
    aliases: ["apache kafka", "event streaming", "kafka streams"],
  },

  // model
  {
    name: "GPT-4o",
    slug: "gpt-4o",
    category: "model",
    aliases: ["gpt4o", "openai gpt", "chatgpt api"],
  },
  {
    name: "Claude",
    slug: "claude",
    category: "model",
    aliases: ["anthropic claude", "claude api", "claude sonnet"],
  },
  {
    name: "Gemini",
    slug: "gemini",
    category: "model",
    aliases: ["google gemini", "gemini api", "gemini pro"],
  },
  {
    name: "Llama",
    slug: "llama",
    category: "model",
    aliases: ["meta llama", "llama 3", "llama models"],
  },
  {
    name: "Mistral",
    slug: "mistral",
    category: "model",
    aliases: ["mistral ai", "mistral api", "mistral large"],
  },
  {
    name: "Whisper",
    slug: "whisper",
    category: "model",
    aliases: ["openai whisper", "speech to text whisper", "whisper asr"],
  },
  {
    name: "ElevenLabs",
    slug: "elevenlabs",
    category: "model",
    aliases: ["eleven labs", "elevenlabs tts", "text to speech elevenlabs"],
  },
  {
    name: "Stable Diffusion",
    slug: "stable-diffusion",
    category: "model",
    aliases: ["stable diffusion", "sd models", "sdxl"],
  },
  {
    name: "DALL-E",
    slug: "dall-e",
    category: "model",
    aliases: ["dalle", "openai dalle", "dall-e 3"],
  },
  {
    name: "Cohere",
    slug: "cohere",
    category: "model",
    aliases: ["cohere api", "cohere llm", "cohere embed"],
  },
  {
    name: "Hugging Face",
    slug: "hugging-face",
    category: "model",
    aliases: ["huggingface", "hf transformers", "hugging face hub"],
  },
  {
    name: "Ollama",
    slug: "ollama",
    category: "model",
    aliases: ["ollama local llm", "local models ollama", "ollama runtime"],
  },

  // tooling
  {
    name: "LangChain",
    slug: "langchain",
    category: "tooling",
    aliases: ["lang chain", "langchain framework", "langchain python"],
  },
  {
    name: "LangGraph",
    slug: "langgraph",
    category: "tooling",
    aliases: ["lang graph", "langgraph agents", "langgraph workflows"],
  },
  {
    name: "CrewAI",
    slug: "crewai",
    category: "tooling",
    aliases: ["crew ai", "multi agent crewai", "crewai framework"],
  },
  {
    name: "LlamaIndex",
    slug: "llamaindex",
    category: "tooling",
    aliases: ["llama index", "llamaindex rag", "llamaindex framework"],
  },
  {
    name: "Flowise",
    slug: "flowise",
    category: "tooling",
    aliases: ["flowise ai", "flowise low code", "flowise builder"],
  },
  {
    name: "n8n",
    slug: "n8n",
    category: "tooling",
    aliases: ["n8n automation", "n8n workflows", "n8n integrations"],
  },
  {
    name: "Zapier",
    slug: "zapier",
    category: "tooling",
    aliases: ["zapier automation", "zapier integrations", "zapier workflows"],
  },
  {
    name: "Make",
    slug: "make",
    category: "tooling",
    aliases: ["make.com", "integromat make", "make automation"],
  },
  {
    name: "Cursor",
    slug: "cursor",
    category: "tooling",
    aliases: ["cursor ide", "cursor ai editor", "cursor agent"],
  },
  {
    name: "Replit",
    slug: "replit",
    category: "tooling",
    aliases: ["replit ai", "replit agent", "replit ide"],
  },
  {
    name: "Semantic Kernel",
    slug: "semantic-kernel",
    category: "tooling",
    aliases: ["semantic kernel", "sk microsoft", "microsoft semantic kernel"],
  },
  {
    name: "AutoGen",
    slug: "autogen",
    category: "tooling",
    aliases: ["autogen agents", "microsoft autogen", "autogen framework"],
  },
  {
    name: "Haystack",
    slug: "haystack",
    category: "tooling",
    aliases: ["deepset haystack", "haystack nlp", "haystack pipelines"],
  },

  // workflow
  {
    name: "RAG",
    slug: "rag",
    category: "workflow",
    aliases: [
      "retrieval augmented generation",
      "rag pipeline",
      "rag architecture",
    ],
  },
  {
    name: "AI Agents",
    slug: "ai-agents",
    category: "workflow",
    aliases: ["ai agents", "autonomous agents", "agentic ai"],
  },
  {
    name: "Prompt Engineering",
    slug: "prompt-engineering",
    category: "workflow",
    aliases: ["prompt engineering", "prompt design", "prompt optimization"],
  },
  {
    name: "Fine-tuning",
    slug: "fine-tuning",
    category: "workflow",
    aliases: ["fine tuning", "llm fine tuning", "model fine tuning"],
  },
  {
    name: "Evals",
    slug: "evals",
    category: "workflow",
    aliases: ["llm evals", "model evaluation evals", "ai evals"],
  },
  {
    name: "AI Observability",
    slug: "ai-observability",
    category: "workflow",
    aliases: ["ai observability", "llm observability", "genai monitoring"],
  },
  {
    name: "Function Calling",
    slug: "function-calling",
    category: "workflow",
    aliases: ["function calling", "tool use llm", "tool calling"],
  },
  {
    name: "Vector Search",
    slug: "vector-search",
    category: "workflow",
    aliases: ["vector search", "similarity search", "semantic search"],
  },
  {
    name: "Embeddings",
    slug: "embeddings",
    category: "workflow",
    aliases: ["embedding models", "text embeddings", "vector embeddings"],
  },
  {
    name: "Multi-agent Systems",
    slug: "multi-agent-systems",
    category: "workflow",
    aliases: [
      "multi agent systems",
      "multi agent orchestration",
      "agent collaboration",
    ],
  },
  {
    name: "Guardrails",
    slug: "guardrails",
    category: "workflow",
    aliases: ["ai guardrails", "llm guardrails", "safety guardrails"],
  },

  // domain
  {
    name: "AI Product Management",
    slug: "ai-product-management",
    category: "domain",
    aliases: ["ai product management", "ai pm", "ai product manager"],
  },
  {
    name: "AI Strategy",
    slug: "ai-strategy",
    category: "domain",
    aliases: ["ai strategy", "enterprise ai strategy", "ai roadmap"],
  },
  {
    name: "AI Ethics",
    slug: "ai-ethics",
    category: "domain",
    aliases: ["ai ethics", "responsible ai", "ai governance"],
  },
  {
    name: "Data Analysis",
    slug: "data-analysis",
    category: "domain",
    aliases: ["data analysis", "data analytics", "analytical skills"],
  },
  {
    name: "Python",
    slug: "python",
    category: "domain",
    aliases: ["python programming", "python development", "python backend"],
  },
  {
    name: "TypeScript",
    slug: "typescript",
    category: "domain",
    aliases: ["typescript programming", "ts development", "typescript backend"],
  },
  {
    name: "API Integration",
    slug: "api-integration",
    category: "domain",
    aliases: ["api integration", "rest api integration", "third party apis"],
  },
  {
    name: "MLOps",
    slug: "mlops",
    category: "domain",
    aliases: ["mlops", "machine learning operations", "ml platform ops"],
  },
  {
    name: "NLP",
    slug: "nlp",
    category: "domain",
    aliases: ["natural language processing", "nlp", "text nlp"],
  },
  {
    name: "FastAPI",
    slug: "fastapi",
    category: "domain",
    aliases: ["fastapi python", "fastapi backend", "fastapi rest api"],
  },
];

export async function seedSkillOntology(): Promise<number> {
  const db = getDb();
  const result = await db
    .insert(skillOntology)
    .values(CANONICAL_AI_SKILLS)
    .onConflictDoNothing({ target: skillOntology.name })
    .returning({ id: skillOntology.id });

  return result.length;
}

export { CANONICAL_AI_SKILLS };
