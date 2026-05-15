/**
 * Onboarding `target_role` values persisted in Supabase (`onboarding_profiles`),
 * including legacy `other` rows still readable from the API.
 */
export const ONBOARDING_TARGET_ROLE_DB_VALUES = [
  "ai_product_manager",
  "ai_generalist",
  "ai_engineer",
  "ai_marketer",
  "ai_operator",
  "ai_native_founder",
  "other",
] as const;

/**
 * Roles that may be set via API (matches UI cards). `other` persists as
 * `other` and maps to the AI Generalist roadmap in generation code.
 */
export const ONBOARDING_TARGET_ROLE_ASSIGNABLE = [
  "ai_product_manager",
  "ai_generalist",
  "ai_engineer",
  "ai_marketer",
  "ai_operator",
  "ai_native_founder",
  "other",
] as const;

export type OnboardingTargetRoleDbValue =
  (typeof ONBOARDING_TARGET_ROLE_DB_VALUES)[number];

export type OnboardingAssignableTargetRole =
  (typeof ONBOARDING_TARGET_ROLE_ASSIGNABLE)[number];

export function isOnboardingTargetRoleDbValue(
  v: string
): v is OnboardingTargetRoleDbValue {
  return (ONBOARDING_TARGET_ROLE_DB_VALUES as readonly string[]).includes(v);
}

export function isAssignableOnboardingTargetRole(
  v: string
): v is OnboardingAssignableTargetRole {
  return (ONBOARDING_TARGET_ROLE_ASSIGNABLE as readonly string[]).includes(v);
}
