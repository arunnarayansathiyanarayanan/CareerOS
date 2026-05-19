import fetch from "node-fetch";

import type { JobPostingSeniority } from "@/db/schema/skillIntelligence";

import {
  BaseScraper,
  JOB_CITY,
  type JobCity,
  type RawJobPosting,
} from "./base";
import { inferSeniority } from "./naukri";

const JSEARCH_HOST = "jsearch.p.rapidapi.com";

export type JSearchJob = {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_description?: string;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_period?: string | null;
  job_posted_at_datetime_utc?: string;
  job_posted_at_timestamp?: number;
  job_apply_link?: string;
  job_publisher?: string;
};

type JSearchResponse = {
  status?: string;
  data?: JSearchJob[];
};

const CITY_PATTERNS: ReadonlyArray<{ city: JobCity; patterns: RegExp[] }> = [
  { city: JOB_CITY.BANGALORE, patterns: [/bangalore/i, /bengaluru/i] },
  { city: JOB_CITY.MUMBAI, patterns: [/mumbai/i, /bombay/i] },
  {
    city: JOB_CITY.DELHI_NCR,
    patterns: [/delhi/i, /ncr/i, /gurgaon/i, /gurugram/i, /noida/i],
  },
  { city: JOB_CITY.HYDERABAD, patterns: [/hyderabad/i] },
  { city: JOB_CITY.CHENNAI, patterns: [/chennai/i] },
  { city: JOB_CITY.PUNE, patterns: [/pune/i] },
  { city: JOB_CITY.KOLKATA, patterns: [/kolkata/i] },
  { city: JOB_CITY.AHMEDABAD, patterns: [/ahmedabad/i] },
  { city: JOB_CITY.REMOTE, patterns: [/remote/i, /\bwfh\b/i] },
];

function mapCityFromJob(job: JSearchJob): JobCity {
  const loc = [job.job_city, job.job_state, job.job_country]
    .filter(Boolean)
    .join(", ");
  for (const { city, patterns } of CITY_PATTERNS) {
    if (patterns.some((p) => p.test(loc))) return city;
  }
  return JOB_CITY.OTHER;
}

function salaryToLpa(
  amount: number | null | undefined,
  period: string | null | undefined,
): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const p = (period ?? "YEAR").toUpperCase();
  let annual = amount;
  if (p === "MONTH") annual = amount * 12;
  if (p === "HOUR") annual = amount * 2080;
  const lpa = annual / 100_000;
  if (lpa <= 0 || lpa > 500) return null;
  return lpa.toFixed(2);
}

function postedAtFromJob(job: JSearchJob): Date {
  if (job.job_posted_at_datetime_utc) {
    const d = new Date(job.job_posted_at_datetime_utc);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (job.job_posted_at_timestamp) {
    return new Date(job.job_posted_at_timestamp * 1000);
  }
  return new Date();
}

export function jsearchJobToPosting(
  job: JSearchJob,
  source: RawJobPosting["source"],
  externalPrefix: string,
): RawJobPosting | null {
  const title = job.job_title?.trim();
  const company = job.employer_name?.trim();
  const jobId = job.job_id?.trim();
  if (!title || !company || !jobId) return null;

  const min = salaryToLpa(job.job_min_salary, job.job_salary_period);
  const max = salaryToLpa(job.job_max_salary, job.job_salary_period);

  return {
    source,
    externalId: `${externalPrefix}:${jobId}`,
    title,
    company,
    city: mapCityFromJob(job),
    seniority: inferSeniority(title, job.job_description?.slice(0, 200)),
    rawSkills: [],
    salaryMinLpa: min,
    salaryMaxLpa: max ?? min,
    postedAt: postedAtFromJob(job),
    descriptionText: [title, company, job.job_description].filter(Boolean).join("\n"),
  };
}

export async function fetchJSearchJobs(
  query: string,
  options?: { page?: number; country?: string },
): Promise<JSearchJob[]> {
  const apiKey = process.env.RAPIDAPI_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "RAPIDAPI_KEY is not set (required for Google/LinkedIn via JSearch)",
    );
  }

  const page = options?.page ?? 1;
  const country = options?.country ?? "in";
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("country", country);
  url.searchParams.set("date_posted", "month");

  const res = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": JSEARCH_HOST,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`JSearch ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as JSearchResponse;
  return json.data ?? [];
}

type JSearchScraperOptions = {
  source: RawJobPosting["source"];
  externalPrefix: string;
  queries: string[];
  filter?: (job: JSearchJob) => boolean;
};

export class JSearchScraper extends BaseScraper {
  readonly source: RawJobPosting["source"];
  private readonly externalPrefix: string;
  private readonly queries: string[];
  private readonly filter?: (job: JSearchJob) => boolean;

  constructor(options: JSearchScraperOptions) {
    super();
    this.source = options.source;
    this.externalPrefix = options.externalPrefix;
    this.queries = options.queries;
    this.filter = options.filter;
  }

  async scrape(): Promise<RawJobPosting[]> {
    const byId = new Map<string, RawJobPosting>();

    for (const query of this.queries) {
      const jobs = await fetchJSearchJobs(query);
      for (const job of jobs) {
        if (this.filter && !this.filter(job)) continue;
        const posting = jsearchJobToPosting(job, this.source, this.externalPrefix);
        if (posting) byId.set(posting.externalId, posting);
      }
    }

    const postings = [...byId.values()];
    await Promise.all(
      postings.map(async (p) => {
        if (!p.descriptionText) return;
        p.rawSkills = await this.normalizeSkills(p.descriptionText);
      }),
    );

    return postings;
  }
}

export function isLinkedInJob(job: JSearchJob): boolean {
  const hay = [
    job.job_publisher,
    job.job_apply_link,
    job.employer_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes("linkedin");
}

export function isGoogleJob(job: JSearchJob): boolean {
  const hay = [job.job_publisher, job.job_apply_link]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    hay.includes("google") ||
    hay.includes("careerbuilder") ||
    hay.includes("via google")
  );
}
