function getCronSecretFromRequest(req: Request): string | null {
  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  if (headerSecret) return headerSecret;

  const authHeader = req.headers.get("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim() || null;
  }

  return null;
}

/** Validates Vercel Cron (`Authorization: Bearer`) or manual `x-cron-secret`. */
export function guardCron(req: Request): void {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    throw new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 500,
    });
  }

  const provided = getCronSecretFromRequest(req);
  if (!provided || provided !== expected) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
}
