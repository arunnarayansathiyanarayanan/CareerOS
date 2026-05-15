-- E3 Proof-of-Work: projects, embeds, recruiter share tokens, templates, publish rate limit

CREATE TYPE public.project_privacy_mode AS ENUM (
  'public',
  'unlisted',
  'recruiter_share'
);

CREATE TYPE public.project_embed_type AS ENUM (
  'github',
  'loom',
  'youtube',
  'notion',
  'deployed_url',
  'screenshot',
  'pdf'
);

CREATE TABLE public.project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  problem_statement TEXT,
  recommended_stack TEXT[] NOT NULL DEFAULT '{}',
  success_criteria TEXT,
  completion_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  one_liner TEXT NOT NULL,
  problem_solved TEXT NOT NULL,
  ai_stack TEXT[] NOT NULL DEFAULT '{}',
  my_role TEXT NOT NULL,
  outcome TEXT NOT NULL,
  privacy_mode public.project_privacy_mode NOT NULL,
  ai_reviewer_score SMALLINT,
  ai_reviewer_data JSONB,
  auto_tags TEXT[] NOT NULL DEFAULT '{}',
  template_id UUID REFERENCES public.project_templates (id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_ai_reviewer_score_range CHECK (
    ai_reviewer_score IS NULL
    OR (ai_reviewer_score >= 1 AND ai_reviewer_score <= 10)
  )
);

CREATE INDEX projects_user_id_is_deleted_idx
  ON public.projects (user_id, is_deleted);

CREATE UNIQUE INDEX projects_username_slug_unique_active
  ON public.projects (username, slug)
  WHERE is_deleted = FALSE;

CREATE INDEX projects_privacy_mode_idx
  ON public.projects (privacy_mode)
  WHERE is_deleted = FALSE;

CREATE TABLE public.project_embeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  type public.project_embed_type NOT NULL,
  url TEXT,
  storage_key TEXT,
  file_size_bytes BIGINT,
  display_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.recruiter_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accessed_at TIMESTAMPTZ,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX recruiter_share_tokens_token_active_idx
  ON public.recruiter_share_tokens (token)
  WHERE is_revoked = FALSE;

CREATE TABLE public.project_publish_rate_limit (
  user_id UUID PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  count SMALLINT NOT NULL
);

CREATE OR REPLACE FUNCTION public.set_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_projects_updated_at();

ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_embeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_publish_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_templates_select_authenticated" ON public.project_templates
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "projects_own_data" ON public.projects
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "project_embeds_own_data" ON public.project_embeds
  FOR ALL
  USING (
    project_id IN (
      SELECT p.id
      FROM public.projects p
      INNER JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "recruiter_share_tokens_own_data" ON public.recruiter_share_tokens
  FOR ALL
  USING (
    project_id IN (
      SELECT p.id
      FROM public.projects p
      INNER JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "project_publish_rate_limit_own_data" ON public.project_publish_rate_limit
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE clerk_id = auth.uid()::text
    )
  );
