import Redis from "ioredis";

let client: Redis | undefined;

function getRedis(): Redis | undefined {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return undefined;
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  }
  return client;
}

/**
 * Try to claim a short-lived dedupe slot for `(profileId, ipHash)`.
 * Returns `true` when the caller should record a view; `false` when deduped out.
 * If Redis is unavailable, returns `true` (dedupe is best-effort).
 */
export async function tryAcquireProfileViewDedupSlot(
  profileId: string,
  ipHash: string,
  ttlSeconds: number
): Promise<boolean> {
  const r = getRedis();
  if (!r) return true;

  const key = `profile_view:${profileId}:${ipHash}`;
  try {
    const res = await r.set(key, "1", "EX", ttlSeconds, "NX");
    return res === "OK";
  } catch {
    return true;
  }
}
