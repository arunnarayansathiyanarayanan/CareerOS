-- E5: optional public display of interview readiness on E4 profiles (default private).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interview_readiness_public BOOLEAN NOT NULL DEFAULT FALSE;
