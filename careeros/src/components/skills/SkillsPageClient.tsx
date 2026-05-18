"use client";

import { SignInButton } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/react";

import { AdvisorChat } from "./AdvisorChat";
import { SalaryChart } from "./SalaryChart";
import { SkillDashboardFilters } from "./SkillDashboardFilters";
import { SkillGapPanel } from "./SkillGapPanel";
import { SkillRankTable } from "./SkillRankTable";
import {
  filtersFromSearchParams,
  toTableRows,
} from "./skill-dashboard-utils";
import type { SalaryChartSkill } from "./types";

type SkillsPageClientProps = {
  isSignedIn: boolean;
};

function SkillsDashboardBody({ isSignedIn }: SkillsPageClientProps) {
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );

  const dashboardQuery = trpc.skillIntelligence.getPublicDashboard.useQuery({
    period: filters.period,
    city: filters.city,
    role: filters.role,
    seniority: filters.seniority,
  });

  const data = dashboardQuery.data;
  const isStale = data?.isStale ?? false;
  const computedAt = data?.computedAt ?? null;

  const salaryChartSkills = useMemo((): SalaryChartSkill[] => {
    if (!data?.top20BySalary) return [];
    return data.top20BySalary
      .filter(
        (s) =>
          s.salaryP25 != null &&
          s.salaryP50 != null &&
          s.salaryP75 != null,
      )
      .slice(0, 10)
      .map((s) => ({
        skillId: s.skillId,
        name: s.skillName,
        salaryP25: s.salaryP25!,
        salaryP50: s.salaryP50!,
        salaryP75: s.salaryP75!,
      }));
  }, [data?.top20BySalary]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-indigo-400/90">
          Skill intelligence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          India AI job market
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          Demand, salary bands, and momentum from scraped postings — filter by
          city, role, and seniority.
        </p>
      </header>

      <SkillDashboardFilters />

      <div className="grid gap-6 xl:grid-cols-2">
        <SkillRankTable
          title="Top skills by volume"
          skills={toTableRows(data?.top20ByVolume ?? [])}
          showChange={false}
          isStale={isStale}
          isLoading={dashboardQuery.isLoading}
          computedAt={computedAt}
        />
        <SkillRankTable
          title="Top skills by salary (P50)"
          skills={toTableRows(data?.top20BySalary ?? [])}
          showChange={false}
          isStale={isStale}
          isLoading={dashboardQuery.isLoading}
          computedAt={computedAt}
        />
      </div>

      <SalaryChart
        skills={salaryChartSkills}
        isLoading={dashboardQuery.isLoading}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SkillRankTable
          title="Rising skills"
          skills={toTableRows(data?.top10Rising ?? [], { includeChange: true })}
          showChange
          isStale={isStale}
          isLoading={dashboardQuery.isLoading}
          computedAt={computedAt}
        />
        <SkillRankTable
          title="Declining skills"
          skills={toTableRows(data?.top10Declining ?? [], {
            includeChange: true,
          })}
          showChange
          isStale={isStale}
          isLoading={dashboardQuery.isLoading}
          computedAt={computedAt}
        />
      </div>

      {isSignedIn ?
        <div className="grid gap-6 lg:grid-cols-2">
          <SkillGapPanel />
          <AdvisorChat />
        </div>
      : <SignedOutPrompt />}
    </div>
  );
}

function SignedOutPrompt() {
  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-zinc-100">
        Personalize with your skill gap
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
        Sign in to see your gap score, add skills to your roadmap, and chat with
        the AI career advisor.
      </p>
      <SignInButton mode="modal">
        <Button className="mt-5 bg-indigo-600 text-white hover:bg-indigo-500">
          Sign in
        </Button>
      </SignInButton>
    </section>
  );
}

function SkillsPageFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function SkillsPageClient(props: SkillsPageClientProps) {
  return (
    <Suspense fallback={<SkillsPageFallback />}>
      <SkillsDashboardBody {...props} />
    </Suspense>
  );
}
