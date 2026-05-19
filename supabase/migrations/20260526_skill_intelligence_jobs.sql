-- Job postings + demand snapshots for skill intelligence pipeline.

DO $$
BEGIN
  CREATE TYPE public.job_posting_source AS ENUM (
    'linkedin',
    'naukri',
    'foundit',
    'wellfound',
    'google'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE public.job_posting_source ADD VALUE IF NOT EXISTS 'google';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.job_posting_seniority AS ENUM ('junior', 'mid', 'senior');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.user_skill_graph_source AS ENUM (
    'declared',
    'project_tag',
    'interview'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.job_postings_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source public.job_posting_source NOT NULL,
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  city TEXT NOT NULL,
  seniority public.job_posting_seniority NOT NULL,
  raw_skills TEXT[] NOT NULL DEFAULT '{}',
  salary_min_lpa NUMERIC(8, 2),
  salary_max_lpa NUMERIC(8, 2),
  posted_at TIMESTAMPTZ NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_postings_raw_source_idx
  ON public.job_postings_raw (source);

CREATE INDEX IF NOT EXISTS job_postings_raw_city_seniority_idx
  ON public.job_postings_raw (city, seniority);

CREATE INDEX IF NOT EXISTS job_postings_raw_posted_at_idx
  ON public.job_postings_raw (posted_at);

CREATE TABLE IF NOT EXISTS public.skill_demand_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES public.skill_ontology (id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  role TEXT NOT NULL,
  seniority public.job_posting_seniority NOT NULL,
  period_end DATE NOT NULL,
  posting_count INTEGER NOT NULL,
  salary_p25 NUMERIC(8, 2),
  salary_p50 NUMERIC(8, 2),
  salary_p75 NUMERIC(8, 2),
  salary_p90 NUMERIC(8, 2),
  sample_size INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT skill_demand_snapshots_skill_city_role_seniority_period_key
    UNIQUE (skill_id, city, role, seniority, period_end)
);

CREATE INDEX IF NOT EXISTS skill_demand_snapshots_skill_id_idx
  ON public.skill_demand_snapshots (skill_id);

CREATE INDEX IF NOT EXISTS skill_demand_snapshots_period_end_idx
  ON public.skill_demand_snapshots (period_end);

CREATE TABLE IF NOT EXISTS public.user_skill_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skill_ontology (id) ON DELETE CASCADE,
  source public.user_skill_graph_source NOT NULL,
  proficiency SMALLINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_skill_graph_user_id_skill_id_key UNIQUE (user_id, skill_id),
  CONSTRAINT user_skill_graph_proficiency_check
    CHECK (proficiency >= 1 AND proficiency <= 5)
);

CREATE INDEX IF NOT EXISTS user_skill_graph_user_id_idx
  ON public.user_skill_graph (user_id);

CREATE INDEX IF NOT EXISTS user_skill_graph_skill_id_idx
  ON public.user_skill_graph (skill_id);

CREATE TABLE IF NOT EXISTS public.skill_gap_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  city TEXT NOT NULL,
  gap_score SMALLINT NOT NULL,
  ranked_skills JSONB NOT NULL DEFAULT '[]',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT skill_gap_scores_gap_score_check
    CHECK (gap_score >= 0 AND gap_score <= 100)
);

CREATE INDEX IF NOT EXISTS skill_gap_scores_user_role_city_idx
  ON public.skill_gap_scores (user_id, role, city);

ALTER TABLE public.job_postings_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_demand_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skill_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_gap_scores ENABLE ROW LEVEL SECURITY;
