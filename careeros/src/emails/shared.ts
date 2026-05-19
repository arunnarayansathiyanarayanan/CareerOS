import { getAppOrigin } from "@/lib/brand";

export const APP_ORIGIN = getAppOrigin();

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
