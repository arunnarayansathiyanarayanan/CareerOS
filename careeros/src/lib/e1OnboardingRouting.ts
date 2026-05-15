/** Shared onboarding URL / role routing (used by middleware, API, and tests). */

export const CAREEROS_ONBOARDING_PATH = "/onboarding" as const;

export function signInRedirectUrlForOnboarding(requestHref: string): URL {
  const url = new URL("/sign-in", requestHref);
  url.searchParams.set("redirect_url", CAREEROS_ONBOARDING_PATH);
  return url;
}

/** Maps persisted target role to the roadmap model role (`other` → generalist starter path). */
export function roadmapModelRoleFromSelection(targetRole: string): string {
  return targetRole === "other" ? "ai_generalist" : targetRole;
}
