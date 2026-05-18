import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/root";

import type { SkillDashboardFilters, SkillTableRow } from "./types";

export type PublicDashboardData =
  inferRouterOutputs<AppRouter>["skillIntelligence"]["getPublicDashboard"];

export function filtersFromSearchParams(
  params: URLSearchParams,
): SkillDashboardFilters {
  const period = params.get("period");
  const seniority = params.get("seniority");

  return {
    period:
      period === "30d" || period === "90d" || period === "180d" ? period : "90d",
    city: params.get("city") ?? undefined,
    role: params.get("role") ?? undefined,
    seniority:
      seniority === "junior" || seniority === "mid" || seniority === "senior" ?
        seniority
      : undefined,
  };
}

export function filtersToSearchParams(
  filters: SkillDashboardFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("period", filters.period);
  if (filters.city) params.set("city", filters.city);
  if (filters.role) params.set("role", filters.role);
  if (filters.seniority) params.set("seniority", filters.seniority);
  return params;
}

export function toTableRows(
  skills: PublicDashboardData["top20ByVolume"],
  options?: { includeChange?: boolean },
): SkillTableRow[] {
  return skills.map((skill, index) => ({
    rank: index + 1,
    name: skill.skillName,
    postingCount: skill.postingCount,
    salaryP50: skill.salaryP50,
    change: options?.includeChange ? skill.changePct : null,
  }));
}
