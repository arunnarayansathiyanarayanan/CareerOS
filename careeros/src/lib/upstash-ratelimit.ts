import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let usernameCheckLimiter: Ratelimit | null | undefined;

/** 20 requests per minute per IP for username availability checks. */
export function getUsernameCheckLimiter(): Ratelimit | null {
  if (usernameCheckLimiter !== undefined) return usernameCheckLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    usernameCheckLimiter = null;
    return null;
  }

  const redis = new Redis({ url, token });
  usernameCheckLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "rl:username-check",
    analytics: true,
  });
  return usernameCheckLimiter;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
