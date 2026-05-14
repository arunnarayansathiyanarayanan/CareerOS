import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CAREEROS_REF_COOKIE_NAME,
  UTM_PARAM_KEYS,
} from "@/lib/careerosAttribution";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const params = request.nextUrl.searchParams;
  const utm: Record<string, string> = {};

  for (const key of UTM_PARAM_KEYS) {
    const v = params.get(key);
    if (v && v.length > 0) utm[key] = v;
  }

  if (Object.keys(utm).length === 0) {
    return res;
  }

  res.cookies.set({
    name: CAREEROS_REF_COOKIE_NAME,
    value: JSON.stringify(utm),
    maxAge: MAX_AGE_SECONDS,
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
