-- Enforce onboarding_profiles.target_role: backfill NULLs, NOT NULL, and spec whitelist.

UPDATE public.onboarding_profiles
SET target_role = 'ai_generalist'
WHERE target_role IS NULL;

ALTER TABLE public.onboarding_profiles
  ALTER COLUMN target_role SET NOT NULL;

ALTER TABLE public.onboarding_profiles
  DROP CONSTRAINT IF EXISTS onboarding_profiles_target_role_check;

ALTER TABLE public.onboarding_profiles
  ADD CONSTRAINT onboarding_profiles_target_role_check
  CHECK (
    target_role IN (
      'ai_product_manager',
      'ai_generalist',
      'ai_engineer',
      'ai_marketer',
      'ai_operator',
      'ai_native_founder',
      'other'
    )
  );
