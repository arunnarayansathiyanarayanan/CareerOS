export const CAREEROS_UTM_STORAGE_KEY = "careeros_utm";
export const CAREEROS_REF_COOKIE_NAME = "careeros_ref";

export const UTM_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmParamKey = (typeof UTM_PARAM_KEYS)[number];

/** Snapshot persisted in sessionStorage under `careeros_utm`. */
export type CareerosAttributionSnapshot = Partial<Record<UtmParamKey, string>> & {
  document_referrer?: string;
  ref_username?: string | null;
};

export function parseCareerosRefCookie(cookieHeader: string): Partial<
  Record<UtmParamKey, string>
> | null {
  const match = cookieHeader.match(
    new RegExp(
      `(?:^|;\\s*)${CAREEROS_REF_COOKIE_NAME}=([^;]*)`,
      "i"
    )
  );
  if (!match?.[1]) return null;
  try {
    const decoded = decodeURIComponent(match[1].trim());
    const parsed = JSON.parse(decoded) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const out: Partial<Record<UtmParamKey, string>> = {};
    for (const key of UTM_PARAM_KEYS) {
      const v = (parsed as Record<string, unknown>)[key];
      if (typeof v === "string" && v.length > 0) out[key] = v;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function readAttributionFromSession(): CareerosAttributionSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CAREEROS_UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as CareerosAttributionSnapshot;
  } catch {
    return null;
  }
}

export function clearAttributionSession(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(CAREEROS_UTM_STORAGE_KEY);
}

export function flattenAttributionSnapshot(
  s: CareerosAttributionSnapshot
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of UTM_PARAM_KEYS) {
    const v = s[key];
    if (typeof v === "string" && v.length > 0) out[key] = v;
  }
  if (typeof s.document_referrer === "string" && s.document_referrer.length > 0) {
    out.document_referrer = s.document_referrer;
  }
  if (typeof s.ref_username === "string" && s.ref_username.length > 0) {
    out.ref_username = s.ref_username;
  }
  return out;
}

function isExternalReferrer(href: string, pageOrigin: string): boolean {
  if (!href) return false;
  try {
    return new URL(href).origin !== pageOrigin;
  } catch {
    return false;
  }
}

/** Read current URL, cookie fallback (post-auth), and external referrer. */
export function captureAttributionFromWindow(): Partial<CareerosAttributionSnapshot> {
  if (typeof window === "undefined") return {};

  const out: Partial<CareerosAttributionSnapshot> = {};
  const url = new URL(window.location.href);

  for (const key of UTM_PARAM_KEYS) {
    const v = url.searchParams.get(key);
    if (v && v.length > 0) out[key] = v;
  }

  const refParam = url.searchParams.get("ref");
  if (refParam && refParam.trim().length > 0) {
    out.ref_username = refParam.trim();
  }

  const fromCookie = parseCareerosRefCookie(document.cookie);
  if (fromCookie) {
    for (const key of UTM_PARAM_KEYS) {
      if (out[key]) continue;
      const v = fromCookie[key];
      if (v) out[key] = v;
    }
  }

  if (isExternalReferrer(document.referrer, window.location.origin)) {
    out.document_referrer = document.referrer;
  }

  return out;
}

/** First-touch merge: keep existing session values; fill only empty fields from `fresh`. */
export function mergeSnapshotIntoSession(
  fresh: Partial<CareerosAttributionSnapshot>
): void {
  if (typeof sessionStorage === "undefined") return;

  const prev = readAttributionFromSession() ?? {};
  const next: CareerosAttributionSnapshot = { ...prev };

  for (const [key, value] of Object.entries(fresh) as [
    keyof CareerosAttributionSnapshot,
    string | null | undefined,
  ][]) {
    if (value === undefined || value === null || value === "") continue;
    const cur = next[key];
    const empty =
      cur === undefined ||
      cur === null ||
      (typeof cur === "string" && cur.length === 0);
    if (empty) {
      (next as Record<string, string | null | undefined>)[key as string] = value;
    }
  }

  sessionStorage.setItem(CAREEROS_UTM_STORAGE_KEY, JSON.stringify(next));
}
