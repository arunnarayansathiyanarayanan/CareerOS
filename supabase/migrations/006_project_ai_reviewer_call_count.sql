-- Track how many times AI review was invoked per project (max 3).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS ai_reviewer_call_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_ai_reviewer_call_count_range CHECK (
    ai_reviewer_call_count >= 0
    AND ai_reviewer_call_count <= 3
  );
