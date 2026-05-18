import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { and, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { resumes } from "@/db/schema/resume";

let uploadLimiter: Ratelimit | null | undefined;
let apiLimiter: Ratelimit | null | undefined;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** 10 resume uploads per hour per user. */
export function getResumeUploadLimiter(): Ratelimit | null {
  if (uploadLimiter !== undefined) return uploadLimiter;

  const redis = getRedis();
  if (!redis) {
    uploadLimiter = null;
    return null;
  }

  uploadLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:resume-upload",
    analytics: true,
  });
  return uploadLimiter;
}

/** 50 resume API calls per hour per user. */
export function getResumeApiLimiter(): Ratelimit | null {
  if (apiLimiter !== undefined) return apiLimiter;

  const redis = getRedis();
  if (!redis) {
    apiLimiter = null;
    return null;
  }

  apiLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, "1 h"),
    prefix: "rl:resume-api",
    analytics: true,
  });
  return apiLimiter;
}

async function countDbUploadsLastHour(userId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), gte(resumes.createdAt, since)));
  return row?.count ?? 0;
}

export type RateLimitResult = { allowed: true } | { allowed: false };

export async function checkResumeUploadRateLimit(
  userId: string
): Promise<RateLimitResult> {
  const limiter = getResumeUploadLimiter();
  if (limiter) {
    const { success } = await limiter.limit(userId);
    return success ? { allowed: true } : { allowed: false };
  }

  const count = await countDbUploadsLastHour(userId);
  return count < 10 ? { allowed: true } : { allowed: false };
}

export async function checkResumeApiRateLimit(
  userId: string
): Promise<RateLimitResult> {
  const limiter = getResumeApiLimiter();
  if (limiter) {
    const { success } = await limiter.limit(userId);
    return success ? { allowed: true } : { allowed: false };
  }

  // Without Redis, uploads are still capped via DB; other API routes are not DB-tracked.
  return { allowed: true };
}

export function rateLimitResponse(): Response {
  return Response.json(
    { error: "Rate limit exceeded. Try again later." },
    { status: 429 }
  );
}
