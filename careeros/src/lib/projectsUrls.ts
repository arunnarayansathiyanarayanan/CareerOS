import { PRODUCT_DOMAIN } from "@/lib/brand";

/** Public product hostname for share/embed links (override via env in staging). */
export function getCareerosPublicHost(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      return u.host;
    } catch {
      return (
        raw.replace(/^https?:\/\//, "").replace(/\/$/, "") || PRODUCT_DOMAIN
      );
    }
  }
  return PRODUCT_DOMAIN;
}

export function projectPublicPath(username: string, slug: string): string {
  return `/p/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}

export function recruiterSharePath(token: string): string {
  return `/r/${encodeURIComponent(token)}`;
}

export function projectPublicUrl(username: string, slug: string): string {
  const host = getCareerosPublicHost();
  return `https://${host}${projectPublicPath(username, slug)}`;
}

export function recruiterShareUrl(token: string): string {
  const host = getCareerosPublicHost();
  return `https://${host}${recruiterSharePath(token)}`;
}

/** Display form without scheme, e.g. `aihired.in/p/user/slug`. */
export function projectPublicDisplayUrl(username: string, slug: string): string {
  return `${getCareerosPublicHost()}${projectPublicPath(username, slug)}`;
}

/** Display form without scheme for recruiter links. */
export function recruiterShareDisplayUrl(token: string): string {
  return `${getCareerosPublicHost()}${recruiterSharePath(token)}`;
}
