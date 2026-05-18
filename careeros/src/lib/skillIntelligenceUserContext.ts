/** Maps profile target role + location to skill intelligence demand dimensions. */

export const PROFILE_TO_DEMAND_ROLE: Record<string, string> = {
  AI_PM: "ai_product_manager",
  AI_GENERALIST: "ai_generalist",
  AI_ENGINEER: "ai_engineer",
  AI_MARKETER: "ai_marketer",
  AI_OPERATOR: "ai_operator",
  AI_FOUNDER: "ai_native_founder",
};

const DEMAND_ROLE_LABELS: Record<string, string> = {
  ai_product_manager: "AI Product Manager",
  ai_engineer: "AI Engineer",
  ai_generalist: "AI Generalist",
  ai_marketer: "AI Marketer",
  ai_operator: "AI Operator",
  ai_native_founder: "AI Founder",
};

const CITY_LABELS: Record<string, string> = {
  bangalore: "Bangalore",
  mumbai: "Mumbai",
  "delhi-ncr": "Delhi NCR",
  hyderabad: "Hyderabad",
  chennai: "Chennai",
  pune: "Pune",
  kolkata: "Kolkata",
  ahmedabad: "Ahmedabad",
  remote: "Remote",
  other: "India",
};

export function demandRoleFromProfileTargetRole(targetRole: string): string {
  return PROFILE_TO_DEMAND_ROLE[targetRole] ?? "ai_generalist";
}

export function cityFromProfileLocation(
  location: string | null | undefined,
): string {
  if (!location?.trim()) return "bangalore";

  const loc = location.toLowerCase();
  if (/bengaluru|bangalore|\bblr\b/.test(loc)) return "bangalore";
  if (/mumbai|bombay|thane|navi mumbai/.test(loc)) return "mumbai";
  if (/delhi|ncr|gurgaon|gurugram|noida|faridabad|ghaziabad/.test(loc)) {
    return "delhi-ncr";
  }
  if (/hyderabad|secunderabad/.test(loc)) return "hyderabad";
  if (/chennai|madras/.test(loc)) return "chennai";
  if (/pune|pimpri/.test(loc)) return "pune";
  if (/kolkata|calcutta/.test(loc)) return "kolkata";
  if (/ahmedabad/.test(loc)) return "ahmedabad";
  if (/remote/.test(loc)) return "remote";
  return "other";
}

export function formatDemandRoleLabel(roleSlug: string): string {
  return (
    DEMAND_ROLE_LABELS[roleSlug] ??
    roleSlug
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function formatCityLabel(citySlug: string): string {
  return CITY_LABELS[citySlug] ?? citySlug;
}

/** Higher = better alignment vs market demand for the role/city. */
export function marketAlignmentPercentile(gapScore: number): number {
  return Math.min(99, Math.max(1, 100 - gapScore));
}
