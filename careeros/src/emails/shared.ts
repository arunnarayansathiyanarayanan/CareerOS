export const APP_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://careeros.com"
).replace(/\/$/, "");

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function skillsPageUrl(): string {
  return `${APP_ORIGIN}/skills`;
}
