import type { NextResponse } from "next/server";

export const CAREEROS_ONBOARDING_GATE_COOKIE = "careeros_onb_gate";

/** Short-lived cache for onboarding gate checks (middleware). */
export const CAREEROS_ONBOARDING_GATE_MAX_AGE = 60 * 15;

export type OnboardingGateCache = {
  complete: boolean;
  lastStep: number;
};

export function parseOnboardingGateCookie(
  raw: string | undefined | null
): OnboardingGateCache | null {
  if (!raw) return null;
  const decoded = raw.trim();
  if (decoded === "1") return { complete: true, lastStep: 1 };
  const m = /^0:(\d+)$/.exec(decoded);
  if (m) {
    const step = Number(m[1]);
    if (Number.isFinite(step) && step >= 1 && step <= 99) {
      return { complete: false, lastStep: Math.floor(step) };
    }
  }
  return null;
}

export function formatOnboardingGateCookie(gate: OnboardingGateCache): string {
  if (gate.complete) return "1";
  return `0:${gate.lastStep}`;
}

export function setOnboardingGateCookie(
  res: NextResponse,
  gate: OnboardingGateCache
): void {
  res.cookies.set({
    name: CAREEROS_ONBOARDING_GATE_COOKIE,
    value: formatOnboardingGateCookie(gate),
    maxAge: CAREEROS_ONBOARDING_GATE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}
