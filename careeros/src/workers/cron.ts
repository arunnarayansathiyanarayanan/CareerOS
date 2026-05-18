// Run `npx drizzle-kit push` after adding skill intelligence schema before enabling these crons.

import { aggregateDemandSnapshots } from "@/workers/jobs/aggregateDemand";
import { sendMonthlyIntelligenceEmails } from "@/workers/jobs/monthlyIntelligenceEmail";
import { runAllScrapers } from "@/workers/scrapers";

export type SkillIntelligenceCronJob = "scrape" | "aggregate" | "email";

export type SkillIntelligenceCronDefinition = {
  job: SkillIntelligenceCronJob;
  /** Vercel cron expression (UTC). */
  schedule: string;
  /** Human-readable schedule in IST. */
  label: string;
  path: string;
};

/**
 * Skill intelligence cron schedules (UTC expressions; labels in IST).
 * Mirror these in `vercel.json` → `crons`.
 */
export const SKILL_INTELLIGENCE_CRONS: SkillIntelligenceCronDefinition[] = [
  {
    job: "scrape",
    schedule: "30 17 * * 6",
    label: "Every Saturday 23:00 IST",
    path: "/api/cron/skill-intelligence?job=scrape",
  },
  {
    job: "aggregate",
    schedule: "30 20 * * 0",
    label: "Every Sunday 02:00 IST",
    path: "/api/cron/skill-intelligence?job=aggregate",
  },
  {
    job: "email",
    schedule: "30 2 1 * *",
    label: "1st of each month 08:00 IST",
    path: "/api/cron/skill-intelligence?job=email",
  },
];

function isScraperEnabled(): boolean {
  return process.env.SKILL_SCRAPER_ENABLED !== "false";
}

export async function dispatchSkillIntelligenceCronJob(
  job: SkillIntelligenceCronJob,
): Promise<{ status: "ok" | "skipped"; detail?: unknown }> {
  switch (job) {
    case "scrape": {
      if (!isScraperEnabled()) {
        return { status: "skipped", detail: { reason: "SKILL_SCRAPER_ENABLED=false" } };
      }
      const detail = await runAllScrapers();
      return { status: "ok", detail };
    }
    case "aggregate":
      await aggregateDemandSnapshots();
      return { status: "ok" };
    case "email":
      await sendMonthlyIntelligenceEmails();
      return { status: "ok" };
    default: {
      const _exhaustive: never = job;
      return _exhaustive;
    }
  }
}
