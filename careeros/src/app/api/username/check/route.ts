import { ilike } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { profiles } from "@/db/schema/profile";
import { users } from "@/db/schema/users";
import {
  isReservedUsername,
  normalizeUsername,
  validateUsernameFormat,
} from "@/lib/username";
import { getClientIp, getUsernameCheckLimiter } from "@/lib/upstash-ratelimit";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  const limiter = getUsernameCheckLimiter();
  if (limiter) {
    const ip = getClientIp(request);
    const { success } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json(
        { available: false, reason: "rate_limited" },
        { status: 429, headers: NO_STORE }
      );
    }
  }

  const raw = new URL(request.url).searchParams.get("username") ?? "";
  const username = normalizeUsername(raw);

  if (!username) {
    return NextResponse.json(
      { available: false, reason: "invalid_length" },
      { headers: NO_STORE }
    );
  }

  const format = validateUsernameFormat(username);
  if (!format.valid) {
    return NextResponse.json(
      { available: false, reason: format.reason },
      { headers: NO_STORE }
    );
  }

  if (isReservedUsername(username)) {
    return NextResponse.json(
      { available: false, reason: "reserved" },
      { headers: NO_STORE }
    );
  }

  try {
    const db = getDb();
    const [profileHit, userHit] = await Promise.all([
      db
        .select({ id: profiles.id })
        .from(profiles)
        .where(ilike(profiles.username, username))
        .limit(1),
      db
        .select({ id: users.id })
        .from(users)
        .where(ilike(users.username, username))
        .limit(1),
    ]);

    if (profileHit.length > 0 || userHit.length > 0) {
      return NextResponse.json(
        { available: false, reason: "taken" },
        { headers: NO_STORE }
      );
    }

    return NextResponse.json({ available: true }, { headers: NO_STORE });
  } catch (e) {
    console.error("[username/check] GET:", e);
    return NextResponse.json(
      { available: false, reason: "unavailable" },
      { status: 503, headers: NO_STORE }
    );
  }
}
