-- Align interview engine FKs with CareerOS public.users (Clerk-provisioned).

ALTER TABLE public.interview_sessions
  DROP CONSTRAINT IF EXISTS interview_sessions_user_id_fkey;

ALTER TABLE public.interview_sessions
  ADD CONSTRAINT interview_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;

ALTER TABLE public.interview_readiness_scores
  DROP CONSTRAINT IF EXISTS interview_readiness_scores_user_id_fkey;

ALTER TABLE public.interview_readiness_scores
  ADD CONSTRAINT interview_readiness_scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;

ALTER TABLE public.interview_weekly_quota
  DROP CONSTRAINT IF EXISTS interview_weekly_quota_user_id_fkey;

ALTER TABLE public.interview_weekly_quota
  ADD CONSTRAINT interview_weekly_quota_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT FALSE;
