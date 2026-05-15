-- E4 Public Profile: profiles, views, endorsements, skill graph
-- Enum blocks are idempotent for partial re-runs (e.g. SQL editor retry).

DO $$
BEGIN
  CREATE TYPE public.profile_target_role AS ENUM (
    'AI_PM',
    'AI_GENERALIST',
    'AI_ENGINEER',
    'AI_MARKETER',
    'AI_OPERATOR',
    'AI_FOUNDER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.profile_availability_status AS ENUM (
    'OPEN_TO_ROLES',
    'OPEN_TO_COLLABS',
    'HEADS_DOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.profile_visibility AS ENUM (
    'PUBLIC',
    'PRIVATE',
    'ANONYMOUS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.profile_view_source AS ENUM (
    'DIRECT',
    'LINKEDIN',
    'TWITTER',
    'WHATSAPP',
    'GOOGLE',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.skill_graph_source AS ENUM (
    'DECLARED',
    'PROJECT_TAG',
    'ENDORSEMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  username VARCHAR(24) NOT NULL UNIQUE,
  headline VARCHAR(160),
  target_role public.profile_target_role NOT NULL,
  location VARCHAR(100),
  availability_status public.profile_availability_status NOT NULL DEFAULT 'HEADS_DOWN',
  visibility public.profile_visibility NOT NULL DEFAULT 'PUBLIC',
  custom_domain VARCHAR(255) UNIQUE,
  ai_native_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  streak_days INTEGER NOT NULL DEFAULT 0,
  streak_last_activity DATE,
  roadmap_progress_pct SMALLINT NOT NULL DEFAULT 0,
  pinned_project_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_username_format_check CHECK (
    username ~ '^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$'
  ),
  CONSTRAINT profiles_pinned_project_ids_len_check CHECK (
    cardinality(pinned_project_ids) <= 5
  ),
  CONSTRAINT profiles_roadmap_progress_pct_check CHECK (
    roadmap_progress_pct >= 0 AND roadmap_progress_pct <= 100
  )
);

CREATE INDEX IF NOT EXISTS profiles_username_non_anonymous_idx ON public.profiles (username)
WHERE visibility <> 'ANONYMOUS'::public.profile_visibility;

CREATE TABLE IF NOT EXISTS public.profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  source public.profile_view_source NOT NULL,
  referrer_url TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS profile_views_profile_id_idx ON public.profile_views (profile_id);

CREATE INDEX IF NOT EXISTS profile_views_profile_id_viewed_at_desc_idx ON public.profile_views (
  profile_id,
  viewed_at DESC
);

CREATE INDEX IF NOT EXISTS profile_views_viewed_at_idx ON public.profile_views (viewed_at);

CREATE TABLE IF NOT EXISTS public.endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  to_profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  skill VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT endorsements_skill_ontology_check CHECK (
    skill IN (
      'LangChain',
      'LangGraph',
      'CrewAI',
      'OpenAI API',
      'Anthropic Claude',
      'RAG',
      'Vector DB',
      'Pinecone',
      'Weaviate',
      'ChromaDB',
      'pgvector',
      'Python',
      'FastAPI',
      'n8n',
      'Zapier',
      'Make',
      'Prompt Engineering',
      'Fine-tuning',
      'Embeddings',
      'Function Calling',
      'AI Agents',
      'Multi-modal AI',
      'Whisper',
      'ElevenLabs',
      'GPT-4o',
      'Gemini',
      'Llama',
      'Mistral',
      'Hugging Face',
      'LlamaIndex',
      'Chainlit',
      'Streamlit',
      'Gradio',
      'Supabase',
      'PostgreSQL',
      'Redis',
      'TypeScript',
      'Next.js',
      'Vercel AI SDK',
      'Replicate',
      'Stable Diffusion',
      'DALL-E',
      'Computer Vision',
      'OCR',
      'NLP',
      'Text-to-SQL',
      'AI Workflow Automation',
      'AutoGen',
      'Semantic Kernel',
      'DSPy',
      'Instructor'
    )
  ),
  CONSTRAINT endorsements_from_user_to_profile_skill_key UNIQUE (
    from_user_id,
    to_profile_id,
    skill
  )
);

CREATE TABLE IF NOT EXISTS public.skill_graph_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  skill VARCHAR(100) NOT NULL,
  source public.skill_graph_source NOT NULL,
  proficiency SMALLINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT skill_graph_entries_skill_ontology_check CHECK (
    skill IN (
      'LangChain',
      'LangGraph',
      'CrewAI',
      'OpenAI API',
      'Anthropic Claude',
      'RAG',
      'Vector DB',
      'Pinecone',
      'Weaviate',
      'ChromaDB',
      'pgvector',
      'Python',
      'FastAPI',
      'n8n',
      'Zapier',
      'Make',
      'Prompt Engineering',
      'Fine-tuning',
      'Embeddings',
      'Function Calling',
      'AI Agents',
      'Multi-modal AI',
      'Whisper',
      'ElevenLabs',
      'GPT-4o',
      'Gemini',
      'Llama',
      'Mistral',
      'Hugging Face',
      'LlamaIndex',
      'Chainlit',
      'Streamlit',
      'Gradio',
      'Supabase',
      'PostgreSQL',
      'Redis',
      'TypeScript',
      'Next.js',
      'Vercel AI SDK',
      'Replicate',
      'Stable Diffusion',
      'DALL-E',
      'Computer Vision',
      'OCR',
      'NLP',
      'Text-to-SQL',
      'AI Workflow Automation',
      'AutoGen',
      'Semantic Kernel',
      'DSPy',
      'Instructor'
    )
  ),
  CONSTRAINT skill_graph_entries_proficiency_check CHECK (
    proficiency IS NULL OR (proficiency >= 1 AND proficiency <= 5)
  ),
  CONSTRAINT skill_graph_entries_profile_id_skill_key UNIQUE (profile_id, skill)
);

CREATE INDEX IF NOT EXISTS skill_graph_entries_profile_id_idx ON public.skill_graph_entries (profile_id);
