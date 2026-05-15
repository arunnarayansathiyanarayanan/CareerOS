-- Track last mutation on roadmaps for dashboard ordering (active vs stale).
ALTER TABLE public.roadmaps
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.roadmaps
SET updated_at = COALESCE(last_regen_at, generated_at);
