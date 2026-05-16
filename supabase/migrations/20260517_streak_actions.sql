-- Daily streak action log (count computed separately in profile UI).

CREATE TABLE IF NOT EXISTS public.streak_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  action_date DATE NOT NULL,
  actions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT streak_actions_user_date_unique UNIQUE (user_id, action_date)
);

CREATE INDEX IF NOT EXISTS streak_actions_user_id_action_date_desc_idx
  ON public.streak_actions (user_id, action_date DESC);

ALTER TABLE public.streak_actions ENABLE ROW LEVEL SECURITY;
