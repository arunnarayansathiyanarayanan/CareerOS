-- Canonical AI skill ontology (seeded via careeros npm run db:seed).

DO $$
BEGIN
  CREATE TYPE public.skill_ontology_category AS ENUM (
    'infra',
    'model',
    'tooling',
    'workflow',
    'domain'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.skill_ontology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  category public.skill_ontology_category NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS skill_ontology_category_idx
  ON public.skill_ontology (category);

CREATE INDEX IF NOT EXISTS skill_ontology_slug_idx
  ON public.skill_ontology (slug);

ALTER TABLE public.skill_ontology ENABLE ROW LEVEL SECURITY;
