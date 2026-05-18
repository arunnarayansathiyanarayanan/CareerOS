-- Community streak counters and event log (used by streak.service via Drizzle).

DO $$
BEGIN
  CREATE TYPE public.streak_event_type AS ENUM (
    'CONCEPT_COMPLETE',
    'PROJECT_PUBLISHED',
    'INTERVIEW_DONE',
    'FEED_POST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.streaks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_ship_date TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS streaks_user_id_unique ON public.streaks (user_id);

CREATE TABLE IF NOT EXISTS public.streak_events (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  event_type public.streak_event_type NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS streak_events_user_id_occurred_at_idx
  ON public.streak_events (user_id, occurred_at DESC);

ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_events ENABLE ROW LEVEL SECURITY;
