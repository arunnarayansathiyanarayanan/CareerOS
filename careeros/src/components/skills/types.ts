import type { jobPostingSeniorityEnum } from "@/db/schema/skillIntelligence";

export type DashboardPeriod = "30d" | "90d" | "180d";

export type DashboardSeniority =
  (typeof jobPostingSeniorityEnum.enumValues)[number];

export type SkillDashboardFilters = {
  city?: string;
  role?: string;
  seniority?: DashboardSeniority;
  period: DashboardPeriod;
};

export type SkillTableRow = {
  rank: number;
  name: string;
  postingCount: number;
  salaryP50: number | null;
  change: number | null;
};

export type SalaryChartSkill = {
  skillId: string;
  name: string;
  salaryP25: number;
  salaryP50: number;
  salaryP75: number;
};
