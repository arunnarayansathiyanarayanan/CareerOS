import type { Profile } from "@/db/schema/profile";

import { getCareerosPublicHost } from "@/lib/projectsUrls";

export const PROFILE_TARGET_ROLE_LABELS: Record<Profile["targetRole"], string> = {
  AI_PM: "AI Product Manager",
  AI_GENERALIST: "AI Generalist",
  AI_ENGINEER: "AI Engineer",
  AI_MARKETER: "AI Marketer",
  AI_OPERATOR: "AI Operator",
  AI_FOUNDER: "AI Founder",
};

export const PROFILE_AVAILABILITY_LABELS: Record<Profile["availabilityStatus"], string> =
  {
    OPEN_TO_ROLES: "Open to roles",
    OPEN_TO_COLLABS: "Open to collabs",
    HEADS_DOWN: "Heads down",
  };

export function publicProfilePath(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

export function publicProfileUrl(username: string): string {
  return `https://${getCareerosPublicHost()}${publicProfilePath(username)}`;
}
