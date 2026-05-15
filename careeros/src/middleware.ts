import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CAREEROS_REF_COOKIE_NAME,
  UTM_PARAM_KEYS,
} from "@/lib/careerosAttribution";
import { getOnboardingGateForClerk } from "@/lib/getOnboardingGateForClerk";
import {
  CAREEROS_ONBOARDING_GATE_COOKIE,
  parseOnboardingGateCookie,
  setOnboardingGateCookie,
} from "@/lib/onboardingMiddlewareCache";

const UTM_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function attachUtmRefCookie(request: NextRequest, res: NextResponse) {
  const params = request.nextUrl.searchParams;
  const utm: Record<string, string> = {};
  for (const key of UTM_PARAM_KEYS) {
    const v = params.get(key);
    if (v && v.length > 0) utm[key] = v;
  }
  if (Object.keys(utm).length === 0) return;
  res.cookies.set({
    name: CAREEROS_REF_COOKIE_NAME,
    value: JSON.stringify(utm),
    maxAge: UTM_MAX_AGE_SECONDS,
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function isOnboardingPath(pathname: string): boolean {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

function isAppGuardedPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/app" ||
    pathname.startsWith("/app/")
  );
}

function isSignInPath(pathname: string): boolean {
  return pathname === "/sign-in" || pathname.startsWith("/sign-in/");
}

function isSignUpPath(pathname: string): boolean {
  return pathname === "/sign-up" || pathname.startsWith("/sign-up/");
}

async function resolveGateForDashboard(
  request: NextRequest,
  userId: string
): Promise<{ complete: boolean; lastStep: number }> {
  const raw = request.cookies.get(CAREEROS_ONBOARDING_GATE_COOKIE)?.value;
  const cached = parseOnboardingGateCookie(raw);
  if (cached?.complete) {
    return cached;
  }
  return getOnboardingGateForClerk(userId);
}

export default clerkMiddleware(
  async (auth, request) => {
    const pathname = request.nextUrl.pathname;

    if (isOnboardingPath(pathname)) {
      const { userId } = await auth();
      if (!userId) {
        const url = new URL("/sign-in", request.url);
        url.searchParams.set("redirect_url", "/onboarding");
        const res = NextResponse.redirect(url);
        attachUtmRefCookie(request, res);
        return res;
      }
      const res = NextResponse.next();
      attachUtmRefCookie(request, res);
      return res;
    }

    if (isAppGuardedPath(pathname)) {
      const authState = await auth();
      if (!authState.userId) {
        const res = authState.redirectToSignIn({
          returnBackUrl: request.url,
        });
        attachUtmRefCookie(request, res);
        return res;
      }
      const gate = await resolveGateForDashboard(request, authState.userId);
      if (!gate.complete) {
        const url = new URL("/onboarding", request.url);
        url.searchParams.set("step", String(gate.lastStep));
        const res = NextResponse.redirect(url);
        setOnboardingGateCookie(res, gate);
        attachUtmRefCookie(request, res);
        return res;
      }
      const res = NextResponse.next();
      setOnboardingGateCookie(res, gate);
      attachUtmRefCookie(request, res);
      return res;
    }

    if (isSignInPath(pathname) || isSignUpPath(pathname)) {
      const { userId } = await auth();
      if (userId) {
        const gate = await getOnboardingGateForClerk(userId);
        if (gate.complete) {
          const res = NextResponse.redirect(new URL("/dashboard", request.url));
          setOnboardingGateCookie(res, gate);
          attachUtmRefCookie(request, res);
          return res;
        }
      }
      const res = NextResponse.next();
      attachUtmRefCookie(request, res);
      return res;
    }

    const res = NextResponse.next();
    attachUtmRefCookie(request, res);
    return res;
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
