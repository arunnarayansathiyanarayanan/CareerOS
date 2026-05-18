-- Community cohorts (weekly role + timezone buckets).

DO $$
BEGIN
  CREATE TYPE public.role AS ENUM (
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

CREATE TABLE IF NOT EXISTS public.cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_role public.role NOT NULL,
  timezone TEXT NOT NULL,
  signup_week TEXT NOT NULL,
  max_size INTEGER NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cohorts_target_role_timezone_signup_week_idx
  ON public.cohorts (target_role, timezone, signup_week);

CREATE TABLE IF NOT EXISTS public.cohort_members (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  cohort_id TEXT NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS cohort_members_user_id_active_unique
  ON public.cohort_members (user_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS cohort_members_user_id_idx ON public.cohort_members (user_id);
CREATE INDEX IF NOT EXISTS cohort_members_cohort_id_idx ON public.cohort_members (cohort_id);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;
