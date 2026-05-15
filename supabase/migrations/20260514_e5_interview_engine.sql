-- E5 AI Mock Interview Engine: sessions, feedback, readiness, weekly quota

DO $$
BEGIN
  CREATE TYPE public.interview_track AS ENUM ('ai_pm', 'ai_generalist');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.interview_session_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'abandoned'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.interview_mode AS ENUM ('voice', 'text');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE public.interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  track public.interview_track NOT NULL,
  sub_mode TEXT NOT NULL,
  status public.interview_session_status NOT NULL DEFAULT 'pending',
  mode public.interview_mode NOT NULL DEFAULT 'voice',
  duration_seconds INTEGER,
  project_context_ids UUID[],
  audio_url TEXT,
  transcript JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT interview_sessions_duration_seconds_nonneg_check CHECK (
    duration_seconds IS NULL OR duration_seconds >= 0
  ),
  CONSTRAINT interview_sessions_sub_mode_track_check CHECK (
    (
      track = 'ai_pm'::public.interview_track
      AND sub_mode IN (
        'product_sense',
        'ai_system_design',
        'ai_prioritization',
        'ai_strategy_case',
        'behavioral'
      )
    )
    OR (
      track = 'ai_generalist'::public.interview_track
      AND sub_mode IN (
        'ai_workflow_design',
        'tool_selection',
        'automation_case',
        'ai_ops_behavioral',
        'cross_functional_ai'
      )
    )
  )
);

CREATE INDEX interview_sessions_user_id_status_created_at_desc_idx
  ON public.interview_sessions (user_id, status, created_at DESC);

CREATE INDEX interview_sessions_user_id_track_completed_at_desc_idx
  ON public.interview_sessions (user_id, track, completed_at DESC NULLS LAST);

CREATE TABLE public.interview_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.interview_sessions (id) ON DELETE CASCADE,
  overall_score NUMERIC(3, 1) NOT NULL,
  rubric_scores JSONB NOT NULL,
  strong_moments JSONB NOT NULL,
  improvement_moments JSONB NOT NULL,
  recommended_next_sub_mode TEXT NOT NULL,
  raw_feedback_text TEXT NOT NULL,
  helpfulness_rating INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT interview_feedback_overall_score_range_check CHECK (
    overall_score >= 1.0 AND overall_score <= 10.0
  ),
  CONSTRAINT interview_feedback_helpfulness_rating_range_check CHECK (
    helpfulness_rating IS NULL
    OR (helpfulness_rating >= 1 AND helpfulness_rating <= 5)
  ),
  CONSTRAINT interview_feedback_rubric_scores_shape_check CHECK (
    rubric_scores ?& ARRAY[
      'structure',
      'clarity',
      'ai_depth',
      'tradeoffs',
      'communication'
    ]
    AND (rubric_scores ->> 'structure')::NUMERIC BETWEEN 1 AND 10
    AND (rubric_scores ->> 'clarity')::NUMERIC BETWEEN 1 AND 10
    AND (rubric_scores ->> 'ai_depth')::NUMERIC BETWEEN 1 AND 10
    AND (rubric_scores ->> 'tradeoffs')::NUMERIC BETWEEN 1 AND 10
    AND (rubric_scores ->> 'communication')::NUMERIC BETWEEN 1 AND 10
  )
);

CREATE TABLE public.interview_readiness_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  track public.interview_track NOT NULL,
  score NUMERIC(4, 1) NOT NULL,
  session_count INTEGER NOT NULL,
  avg_overall_score NUMERIC(3, 1) NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT interview_readiness_scores_score_range_check CHECK (
    score >= 1.0 AND score <= 100.0
  ),
  CONSTRAINT interview_readiness_scores_session_count_nonneg_check CHECK (
    session_count >= 0
  ),
  CONSTRAINT interview_readiness_scores_avg_overall_score_range_check CHECK (
    avg_overall_score >= 1.0 AND avg_overall_score <= 10.0
  ),
  CONSTRAINT interview_readiness_scores_user_id_track_key UNIQUE (user_id, track)
);

CREATE TABLE public.interview_weekly_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  sessions_used INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT interview_weekly_quota_sessions_used_nonneg_check CHECK (
    sessions_used >= 0
  ),
  CONSTRAINT interview_weekly_quota_user_id_week_start_key UNIQUE (user_id, week_start)
);

CREATE OR REPLACE FUNCTION public.enforce_interview_feedback_helpfulness_only_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.overall_score IS DISTINCT FROM OLD.overall_score
    OR NEW.rubric_scores IS DISTINCT FROM OLD.rubric_scores
    OR NEW.strong_moments IS DISTINCT FROM OLD.strong_moments
    OR NEW.improvement_moments IS DISTINCT FROM OLD.improvement_moments
    OR NEW.recommended_next_sub_mode IS DISTINCT FROM OLD.recommended_next_sub_mode
    OR NEW.raw_feedback_text IS DISTINCT FROM OLD.raw_feedback_text
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only helpfulness_rating may be updated on interview_feedback';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER interview_feedback_helpfulness_only_update
  BEFORE UPDATE ON public.interview_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interview_feedback_helpfulness_only_update();

CREATE OR REPLACE FUNCTION public.get_or_create_weekly_quota(p_user_id UUID)
RETURNS public.interview_weekly_quota
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE := date_trunc('week', NOW()::DATE)::DATE;
  v_row public.interview_weekly_quota;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.interview_weekly_quota (user_id, week_start, sessions_used)
  VALUES (p_user_id, v_week_start, 0)
  ON CONFLICT (user_id, week_start) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.interview_weekly_quota
  WHERE user_id = p_user_id
    AND week_start = v_week_start;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_weekly_quota(UUID) TO authenticated;

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_readiness_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_weekly_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY interview_sessions_select_own ON public.interview_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY interview_sessions_insert_own ON public.interview_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY interview_sessions_update_own ON public.interview_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY interview_feedback_select_own ON public.interview_feedback
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT s.id
      FROM public.interview_sessions s
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY interview_feedback_insert_own ON public.interview_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT s.id
      FROM public.interview_sessions s
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY interview_feedback_update_helpfulness_own ON public.interview_feedback
  FOR UPDATE
  TO authenticated
  USING (
    session_id IN (
      SELECT s.id
      FROM public.interview_sessions s
      WHERE s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT s.id
      FROM public.interview_sessions s
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY interview_readiness_scores_select_own ON public.interview_readiness_scores
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY interview_readiness_scores_insert_own ON public.interview_readiness_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY interview_readiness_scores_update_own ON public.interview_readiness_scores
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY interview_weekly_quota_select_own ON public.interview_weekly_quota
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY interview_weekly_quota_insert_own ON public.interview_weekly_quota
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY interview_weekly_quota_update_own ON public.interview_weekly_quota
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
