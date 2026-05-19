import fetch from "node-fetch";

import {
  BaseScraper,
  JOB_CITY,
  type JobCity,
  type RawJobPosting,
} from "./base";
import { inferSeniority, parsePostedDate } from "./naukri";

type AdzunaJob = {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  description?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
};

type AdzunaResponse = {
  results?: AdzunaJob[];
};

const SEARCH_QUERIES = [
  "artificial intelligence",
  "machine learning engineer",
  "AI product manager",
  "data scientist AI",
] as const;

const CITY_PATTERNS: ReadonlyArray<{ city: JobCity; patterns: RegExp[] }> = [
  { city: JOB_CITY.BANGALORE, patterns: [/bangalore/i, /bengaluru/i] },
  { city: JOB_CITY.MUMBAI, patterns: [/mumbai/i] },
  {
    city: JOB_CITY.DELHI_NCR,
    patterns: [/delhi/i, /gurgaon/i, /gurugram/i, /noida/i],
  },
  { city: JOB_CITY.HYDERABAD, patterns: [/hyderabad/i] },
  { city: JOB_CITY.CHENNAI, patterns: [/chennai/i] },
  { city: JOB_CITY.PUNE, patterns: [/pune/i] },
  { city: JOB_CITY.REMOTE, patterns: [/remote/i] },
];

function mapCity(location: string): JobCity {
  for (const { city, patterns } of CITY_PATTERNS) {
    if (patterns.some((p) => p.test(location))) return city;
  }
  return JOB_CITY.OTHER;
}

/** Adzuna salaries are annual INR; convert to LPA (lakhs). */
function inrAnnualToLpa(amount: number | undefined): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  const lpa = amount / 100_000;
  if (lpa > 500) return null;
  return lpa.toFixed(2);
}

export class AdzunaScraper extends BaseScraper {
  readonly source = "foundit" as const;

  async scrape(): Promise<RawJobPosting[]> {
    const appId = process.env.ADZUNA_APP_ID?.trim();
    const appKey = process.env.ADZUNA_APP_KEY?.trim();
    if (!appId || !appKey) {
      throw new Error(
        "ADZUNA_APP_ID and ADZUNA_APP_KEY are required (free at https://developer.adzuna.com/)",
      );
    }

    const byId = new Map<string, RawJobPosting>();

    for (const what of SEARCH_QUERIES) {
      const url = new URL(
        `https://api.adzuna.com/v1/api/jobs/in/search/1`,
      );
      url.searchParams.set("app_id", appId);
      url.searchParams.set("app_key", appKey);
      url.searchParams.set("what", what);
      url.searchParams.set("where", "india");
      url.searchParams.set("results_per_page", "50");
      url.searchParams.set("max_days_old", "30");
      url.searchParams.set("content-type", "application/json");

      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Adzuna ${res.status}: ${body.slice(0, 200)}`);
      }

      const json = (await res.json()) as AdzunaResponse;
      for (const job of json.results ?? []) {
        const title = job.title?.trim();
        const company = job.company?.display_name?.trim();
        if (!title || !company || !job.id) continue;

        const location =
          job.location?.display_name ??
          job.location?.area?.join(", ") ??
          "";
        const min = inrAnnualToLpa(job.salary_min);
        const max = inrAnnualToLpa(job.salary_max);

        const posting: RawJobPosting = {
          source: "foundit",
          externalId: `adzuna:${job.id}`,
          title,
          company,
          city: mapCity(location),
          seniority: inferSeniority(title, job.description?.slice(0, 300)),
          rawSkills: [],
          salaryMinLpa: min,
          salaryMaxLpa: max ?? min,
          postedAt: job.created ? parsePostedDate(job.created) : new Date(),
          descriptionText: [title, company, job.description]
            .filter(Boolean)
            .join("\n"),
        };

        byId.set(posting.externalId, posting);
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
