-- Paid subscriptions and per-user notification opt-ins.

DO $$
BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'canceled',
    'past_due',
    'trialing'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('pro');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status public.subscription_status NOT NULL DEFAULT 'active',
  plan public.subscription_plan NOT NULL DEFAULT 'pro',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_status_idx
  ON public.subscriptions (status);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  intelligence_emails BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_preferences_intelligence_emails_idx
  ON public.notification_preferences (intelligence_emails)
  WHERE intelligence_emails = TRUE;
