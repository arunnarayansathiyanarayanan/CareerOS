-- User-submitted stack labels that did not match the canonical skill ontology.

CREATE TABLE IF NOT EXISTS public.skill_ontology_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS skill_ontology_requests_user_id_idx
  ON public.skill_ontology_requests (user_id);

CREATE INDEX IF NOT EXISTS skill_ontology_requests_project_id_idx
  ON public.skill_ontology_requests (project_id);
