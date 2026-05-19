/** Product display name (UI, metadata, emails, OG images, exports). */
export const PRODUCT_NAME = "Aihired";

export const PRODUCT_TAGLINE = "AI hiring platform";

/** Production hostname (no scheme). */
export const PRODUCT_DOMAIN = "aihired.in";

export const PRODUCT_ORIGIN = `https://${PRODUCT_DOMAIN}`;

export const SUPPORT_EMAIL = `support@${PRODUCT_DOMAIN}`;

/** Canonical app origin; `NEXT_PUBLIC_APP_URL` overrides for local/staging. */
export function getAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return PRODUCT_ORIGIN;
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, "");
}
