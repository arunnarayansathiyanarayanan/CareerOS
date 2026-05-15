-- Replace JSONB `roadmaps` with normalized `roadmaps` + `roadmap_items` (Drizzle schema).

DROP POLICY IF EXISTS "roadmaps_own_data" ON public.roadmaps;
DROP INDEX IF EXISTS idx_roadmaps_user_id_current;
DROP TABLE IF EXISTS public.roadmaps;

CREATE TYPE public.roadmap_target_role AS ENUM (
  'AI_PM',
  'AI_GENERALIST',
  'AI_ENGINEER',
  'AI_MARKETER',
  'AI_OPERATOR',
  'AI_FOUNDER'
);

CREATE TYPE public.roadmap_status AS ENUM ('active', 'stale', 'failed');

CREATE TYPE public.roadmap_item_type AS ENUM ('concept', 'project', 'milestone');

CREATE TYPE public.roadmap_item_status AS ENUM (
  'not_started',
  'in_progress',
  'completed',
  'skipped'
);

CREATE TABLE public.roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_role public.roadmap_target_role NOT NULL,
  version INT NOT NULL DEFAULT 1,
  ai_native_ready_score INT NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_regen_at TIMESTAMPTZ,
  status public.roadmap_status NOT NULL DEFAULT 'active'
);

CREATE INDEX roadmaps_user_id_idx ON public.roadmaps (user_id);

CREATE TABLE public.roadmap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES public.roadmaps (id) ON DELETE CASCADE,
  type public.roadmap_item_type NOT NULL,
  phase TEXT NOT NULL,
  phase_order INT NOT NULL,
  item_order INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  estimated_hours INT NOT NULL,
  difficulty INT NOT NULL,
  dependencies UUID[] NOT NULL DEFAULT '{}',
  status public.roadmap_item_status NOT NULL DEFAULT 'not_started',
  user_note TEXT,
  external_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  proof_of_work_url TEXT,
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  completion_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roadmap_items_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 5)
);

CREATE INDEX roadmap_items_roadmap_id_type_idx
  ON public.roadmap_items (roadmap_id, type);

CREATE INDEX roadmap_items_roadmap_id_phase_idx
  ON public.roadmap_items (roadmap_id, phase);

CREATE OR REPLACE FUNCTION public.set_roadmap_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER roadmap_items_updated_at
  BEFORE UPDATE ON public.roadmap_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_roadmap_items_updated_at();

ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roadmaps_own_data" ON public.roadmaps
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "roadmap_items_own_data" ON public.roadmap_items
  FOR ALL
  USING (
    roadmap_id IN (
      SELECT r.id
      FROM public.roadmaps r
      INNER JOIN public.users u ON u.id = r.user_id
      WHERE u.clerk_id = auth.uid()::text
    )
  );
