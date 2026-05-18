"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  filtersFromSearchParams,
  filtersToSearchParams,
} from "./skill-dashboard-utils";
import type { DashboardPeriod, SkillDashboardFilters } from "./types";

const CITIES = [
  { value: "all", label: "All cities" },
  { value: "bangalore", label: "Bangalore" },
  { value: "mumbai", label: "Mumbai" },
  { value: "delhi-ncr", label: "Delhi NCR" },
  { value: "hyderabad", label: "Hyderabad" },
  { value: "chennai", label: "Chennai" },
  { value: "pune", label: "Pune" },
  { value: "kolkata", label: "Kolkata" },
  { value: "ahmedabad", label: "Ahmedabad" },
  { value: "remote", label: "Remote" },
] as const;

const ROLES = [
  { value: "all", label: "All roles" },
  { value: "ai_product_manager", label: "AI Product Manager" },
  { value: "ai_engineer", label: "AI Engineer" },
  { value: "ai_generalist", label: "AI Generalist" },
  { value: "ai_marketer", label: "AI Marketer" },
  { value: "ai_operator", label: "AI Operator" },
  { value: "ai_native_founder", label: "AI Founder" },
] as const;

const SENIORITIES = [
  { value: "all", label: "All levels" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
] as const;

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "180d", label: "180 days" },
];

type SkillDashboardFiltersProps = {
  onChange?: (filters: SkillDashboardFilters) => void;
};

export function SkillDashboardFilters({ onChange }: SkillDashboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );

  const updateFilters = useCallback(
    (patch: Partial<SkillDashboardFilters>) => {
      const next: SkillDashboardFilters = { ...filters, ...patch };
      const params = filtersToSearchParams(next);
      router.replace(`/skills?${params.toString()}`, { scroll: false });
      onChange?.(next);
    },
    [filters, onChange, router],
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="City"
        value={filters.city ?? "all"}
        onValueChange={(value) =>
          updateFilters({ city: value === "all" ? undefined : value })
        }
        options={CITIES}
      />
      <FilterSelect
        label="Role"
        value={filters.role ?? "all"}
        onValueChange={(value) =>
          updateFilters({ role: value === "all" ? undefined : value })
        }
        options={ROLES}
      />
      <FilterSelect
        label="Seniority"
        value={filters.seniority ?? "all"}
        onValueChange={(value) =>
          updateFilters({
            seniority:
              value === "all" ?
                undefined
              : (value as SkillDashboardFilters["seniority"]),
          })
        }
        options={SENIORITIES}
      />
      <FilterSelect
        label="Period"
        value={filters.period}
        onValueChange={(value) =>
          updateFilters({ period: value as DashboardPeriod })
        }
        options={PERIODS}
      />
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <Select value={value} onValueChange={(v) => onValueChange(v as T)}>
        <SelectTrigger className="h-9 w-full min-w-[140px] border-zinc-800 bg-zinc-900/60 text-zinc-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
