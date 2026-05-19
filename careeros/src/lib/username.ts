/** Public username: 3–24 chars, lowercase alphanumeric with internal hyphens. */
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/;

export const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "blog",
  "careers",
  "help",
  "login",
  "logout",
  "me",
  "settings",
  "signup",
  "u",
  "p",
  "og",
  "static",
  "null",
  "undefined",
  "careeros",
  "aihired",
  "support",
  "terms",
  "privacy",
]);

export type UsernameUnavailableReason =
  | "reserved"
  | "taken"
  | "invalid_length"
  | "invalid_format";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsernameFormat(
  username: string
): { valid: true } | { valid: false; reason: UsernameUnavailableReason } {
  if (username.length < 3 || username.length > 24) {
    return { valid: false, reason: "invalid_length" };
  }
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, reason: "invalid_format" };
  }
  return { valid: true };
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}

export function buildUsernameSuggestions(base: string): [string, string] {
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  // Underscores are not allowed by USERNAME_REGEX / DB constraint; use hyphen.
  return [`${base}-${suffix}`, `${base}-ai`];
}
