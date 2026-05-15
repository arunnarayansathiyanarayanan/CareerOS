import type { TargetRole } from "@/types/roadmap";

const ONBOARDING_TO_TARGET_ROLE: Record<string, TargetRole> = {
  ai_product_manager: "AI_PM",
  ai_generalist: "AI_GENERALIST",
  ai_engineer: "AI_ENGINEER",
  ai_marketer: "AI_MARKETER",
  ai_operator: "AI_OPERATOR",
  ai_native_founder: "AI_FOUNDER",
  other: "AI_GENERALIST",
};

/** Maps onboarding profile `target_role` to normalized `roadmap_target_role`. */
export function targetRoleFromOnboardingSelection(
  selection: string | null | undefined
): TargetRole {
  if (selection && selection in ONBOARDING_TO_TARGET_ROLE) {
    return ONBOARDING_TO_TARGET_ROLE[selection];
  }
  return "AI_GENERALIST";
}
