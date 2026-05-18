import * as cheerio from "cheerio";
import fetch from "node-fetch";

import type { JobPostingSeniority } from "@/db/schema/skillIntelligence";

import { BaseScraper, JOB_CITY, type JobCity, type RawJobPosting } from "./base";

const CITY_ALIASES: ReadonlyArray<{ city: JobCity; patterns: RegExp[] }> = [
  {
    city: JOB_CITY.BANGALORE,
    patterns: [/bangalore/i, /bengaluru/i, /\bblr\b/i],
  },
  {
    city: JOB_CITY.MUMBAI,
    patterns: [/mumbai/i, /bombay/i, /navi mumbai/i, /thane/i],
  },
  {
    city: JOB_CITY.DELHI_NCR,
    patterns: [
      /delhi/i,
      /ncr/i,
      /gurgaon/i,
      /gurugram/i,
      /noida/i,
      /faridabad/i,
      /ghaziabad/i,
    ],
  },
  {
    city: JOB_CITY.HYDERABAD,
    patterns: [/hyderabad/i, /secunderabad/i],
  },
  {
    city: JOB_CITY.CHENNAI,
    patterns: [/chennai/i, /madras/i],
  },
  {
    city: JOB_CITY.PUNE,
    patterns: [/pune/i, /pimpri/i],
  },
  {
    city: JOB_CITY.KOLKATA,
    patterns: [/kolkata/i, /calcutta/i],
  },
  {
    city: JOB_CITY.AHMEDABAD,
    patterns: [/ahmedabad/i],
  },
  {
    city: JOB_CITY.REMOTE,
    patterns: [/remote/i, /work from home/i, /\bwfh\b/i],
  },
];

function mapCity(rawLocation: string): JobCity {
  const loc = rawLocation.trim();
  if (!loc) return JOB_CITY.OTHER;

  for (const { city, patterns } of CITY_ALIASES) {
    if (patterns.some((p) => p.test(loc))) return city;
  }

  return JOB_CITY.OTHER;
}

const SEARCH_URL =
  "https://www.naukri.com/jobs-in-india?k=ai+generalist";

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.naukri.com/",
};

type NaukriJobJson = {
  jobId?: string | number;
  title?: string;
  companyName?: string;
  company?: string;
  location?: string;
  placeholders?: Array<{ label?: string; type?: string }>;
  salaryDetail?: { label?: string };
  footerPlaceholderLabel?: string;
  createdDate?: string;
  jdURL?: string;
  tagsAndSkills?: string;
  description?: string;
  minimumExperience?: string | number;
  maximumExperience?: string | number;
};

export function parseSalaryLpa(
  raw: string,
): { min: string | null; max: string | null } {
  const text = raw.replace(/,/g, "").trim();
  if (!text || /not disclosed|unpaid/i.test(text)) {
    return { min: null, max: null };
  }

  const lacMatch = text.match(
    /([\d.]+)\s*(?:-|to)\s*([\d.]+)\s*(?:lac|lacs|lpa)/i,
  );
  if (lacMatch) {
    return { min: lacMatch[1], max: lacMatch[2] };
  }

  const singleLac = text.match(/([\d.]+)\s*(?:lac|lacs|lpa)/i);
  if (singleLac) {
    return { min: singleLac[1], max: singleLac[1] };
  }

  const croreMatch = text.match(
    /([\d.]+)\s*(?:-|to)\s*([\d.]+)\s*(?:crore|cr)/i,
  );
  if (croreMatch) {
    const min = (parseFloat(croreMatch[1]) * 100).toString();
    const max = (parseFloat(croreMatch[2]) * 100).toString();
    return { min, max };
  }

  return { min: null, max: null };
}

export function parsePostedDate(raw: string): Date {
  const text = raw.trim().toLowerCase();
  const now = new Date();

  if (!text || text === "just now" || text === "today") return now;

  const dayMatch = text.match(/(\d+)\s*day/);
  if (dayMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() - Number(dayMatch[1]));
    return d;
  }

  const weekMatch = text.match(/(\d+)\s*week/);
  if (weekMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() - Number(weekMatch[1]) * 7);
    return d;
  }

  const monthMatch = text.match(/(\d+)\s*month/);
  if (monthMatch) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - Number(monthMatch[1]));
    return d;
  }

  if (text.includes("30+")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed);

  return now;
}

export function inferSeniority(
  title: string,
  experienceText?: string,
): JobPostingSeniority {
  const hay = `${title} ${experienceText ?? ""}`.toLowerCase();

  if (
    /\b(intern|fresher|junior|entry[\s-]?level|0[\s-]*[-–]?[12]\s*y)\b/.test(
      hay,
    )
  ) {
    return "junior";
  }

  if (
    /\b(senior|sr\.|lead|principal|architect|staff|head|director|8\+|10\+)\b/.test(
      hay,
    )
  ) {
    return "senior";
  }

  return "mid";
}

function buildExternalId(jobId: string, jobUrl?: string): string {
  const fromUrl = jobUrl?.match(/job-listings-[^-]+-(\d+)/i)?.[1];
  const id = fromUrl ?? jobId;
  return `naukri:${id}`;
}

function extractLocation(job: NaukriJobJson): string {
  if (job.location?.trim()) return job.location.trim();
  const labels =
    job.placeholders
      ?.map((p) => p.label?.trim())
      .filter((l): l is string => Boolean(l)) ?? [];
  return labels.join(", ");
}

function extractEmbeddedJobs(html: string): NaukriJobJson[] {
  const jobs: NaukriJobJson[] = [];
  const re = /"jobDetails"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const arr = JSON.parse(match[1]) as unknown;
      if (Array.isArray(arr) && arr.length > 0) {
        jobs.push(...(arr as NaukriJobJson[]));
      }
    } catch {
      // skip malformed chunk
    }
  }
  return jobs;
}

function parseHtmlCards(html: string): RawJobPosting[] {
  const $ = cheerio.load(html);
  const postings: RawJobPosting[] = [];
  const seen = new Set<string>();

  const cardSelectors = [
    ".srp-jobtuple-wrapper",
    ".cust-job-tuple",
    "article.jobTuple",
  ];

  for (const selector of cardSelectors) {
    $(selector).each((_, el) => {
      const card = $(el);
      const title =
        card.find("a.title, h2 a, .title").first().text().trim() ||
        card.find("[class*='title']").first().text().trim();
      const company =
        card.find(".comp-name, .subTitle, [class*='comp-name']").first().text().trim() ||
        card.find("a.subTitle").first().text().trim();
      const location =
        card.find(".locWdth, .location, [class*='loc']").first().text().trim();
      const salary =
        card.find(".salary, [class*='salary']").first().text().trim();
      const posted =
        card
          .find(".job-post-day, .type, span[class*='posted']")
          .first()
          .text()
          .trim();
      const href =
        card.find("a.title, h2 a").first().attr("href") ??
        card.find("a[href*='job-listings']").first().attr("href");
      const jobId =
        card.attr("data-job-id") ??
        card.find("[data-job-id]").attr("data-job-id") ??
        href?.match(/(\d{6,})/)?.[1] ??
        `${title}:${company}`;

      if (!title || !company) return;

      const externalId = buildExternalId(String(jobId), href ?? undefined);
      if (seen.has(externalId)) return;
      seen.add(externalId);

      const { min, max } = parseSalaryLpa(salary);
      const tags = card
        .find(".tags-gt li, .tag, [class*='skill']")
        .map((__, tag) => $(tag).text().trim())
        .get()
        .filter(Boolean)
        .join(", ");

      postings.push({
        source: "naukri",
        externalId,
        title,
        company,
        city: mapCity(location),
        seniority: inferSeniority(
          title,
          card.find(".expwdth, [class*='exp']").first().text(),
        ),
        rawSkills: [],
        salaryMinLpa: min,
        salaryMaxLpa: max,
        postedAt: parsePostedDate(posted),
        descriptionText: [title, company, tags, salary].filter(Boolean).join("\n"),
      });
    });

    if (postings.length > 0) break;
  }

  return postings;
}

function jsonToPosting(job: NaukriJobJson): RawJobPosting | null {
  const title = job.title?.trim();
  const company = (job.companyName ?? job.company)?.trim();
  const jobId = job.jobId != null ? String(job.jobId) : "";
  if (!title || !company || !jobId) return null;

  const location = extractLocation(job);
  const salaryLabel = job.salaryDetail?.label ?? "";
  const { min, max } = parseSalaryLpa(salaryLabel);
  const exp =
    job.minimumExperience != null || job.maximumExperience != null
      ? `${job.minimumExperience ?? ""}-${job.maximumExperience ?? ""} yrs`
      : undefined;

  return {
    source: "naukri",
    externalId: buildExternalId(jobId, job.jdURL),
    title,
    company,
    city: mapCity(location),
    seniority: inferSeniority(title, exp),
    rawSkills: [],
    salaryMinLpa: min,
    salaryMaxLpa: max,
    postedAt: job.createdDate
      ? parsePostedDate(job.createdDate)
      : parsePostedDate(job.footerPlaceholderLabel ?? ""),
    descriptionText: [
      title,
      company,
      job.tagsAndSkills,
      job.description,
      salaryLabel,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export class NaukriScraper extends BaseScraper {
  readonly source = "naukri" as const;

  async scrape(): Promise<RawJobPosting[]> {
    const res = await fetch(SEARCH_URL, { headers: FETCH_HEADERS });
    if (!res.ok) {
      throw new Error(`Naukri fetch failed: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const byId = new Map<string, RawJobPosting>();

    for (const job of extractEmbeddedJobs(html)) {
      const posting = jsonToPosting(job);
      if (posting) byId.set(posting.externalId, posting);
    }

    for (const posting of parseHtmlCards(html)) {
      if (!byId.has(posting.externalId)) {
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
