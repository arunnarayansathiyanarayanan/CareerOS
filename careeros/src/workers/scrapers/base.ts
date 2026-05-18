import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  jobPostingsRaw,
  skillOntology,
  type JobPostingSeniority,
  type JobPostingSource,
} from "@/db/schema/skillIntelligence";
import { openai } from "@/lib/ai/openai-client";

/** Canonical cities used in skill demand / job posting analytics. */
export const JOB_CITY = {
  BANGALORE: "bangalore",
  MUMBAI: "mumbai",
  DELHI_NCR: "delhi-ncr",
  HYDERABAD: "hyderabad",
  CHENNAI: "chennai",
  PUNE: "pune",
  KOLKATA: "kolkata",
  AHMEDABAD: "ahmedabad",
  REMOTE: "remote",
  OTHER: "other",
} as const;

export type JobCity = (typeof JOB_CITY)[keyof typeof JOB_CITY];

export type RawJobPosting = {
  source: JobPostingSource;
  externalId: string;
  title: string;
  company: string;
  city: JobCity;
  seniority: JobPostingSeniority;
  rawSkills: string[];
  salaryMinLpa?: string | null;
  salaryMaxLpa?: string | null;
  postedAt: Date;
  /** Free-text snippet used for skill extraction (not persisted). */
  descriptionText?: string;
};

const SKILL_MODEL = "gpt-4o-mini" as const;

const SKILL_SYSTEM_PROMPT =
  "Extract technical skill names from the job description. Return ONLY JSON: { \"skills\": string[] } where each string is a slug from the provided ontology list. Omit skills not in the list.";

let cachedSlugList: string[] | null = null;

async function loadOntologySlugs(): Promise<string[]> {
  if (cachedSlugList) return cachedSlugList;
  const db = getDb();
  const rows = await db
    .select({ slug: skillOntology.slug })
    .from(skillOntology)
    .where(eq(skillOntology.isActive, true));
  cachedSlugList = rows.map((r) => r.slug);
  return cachedSlugList;
}

export abstract class BaseScraper {
  abstract readonly source: JobPostingSource;

  abstract scrape(): Promise<RawJobPosting[]>;

  async normalizeSkills(rawText: string): Promise<string[]> {
    const text = rawText.trim();
    if (!text) return [];

    const slugs = await loadOntologySlugs();
    if (slugs.length === 0) return [];

    const res = await openai.chat.completions.create({
      model: SKILL_MODEL,
      messages: [
        { role: "system", content: SKILL_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Ontology slugs: ${JSON.stringify(slugs)}\n\nJob text:\n${text.slice(0, 12_000)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 400,
    });

    const content = res.choices[0]?.message?.content;
    if (!content) return [];

    const slugSet = new Set(slugs);
    let parsed: unknown;
    try {
      parsed = JSON.parse(content) as unknown;
    } catch {
      return [];
    }

    const raw =
      parsed &&
      typeof parsed === "object" &&
      "skills" in parsed &&
      Array.isArray((parsed as { skills: unknown }).skills)
        ? (parsed as { skills: unknown[] }).skills
        : [];

    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
      if (typeof item !== "string") continue;
      const slug = item.trim().toLowerCase();
      if (!slugSet.has(slug) || seen.has(slug)) continue;
      seen.add(slug);
      out.push(slug);
    }
    return out;
  }

  async upsertPostings(postings: RawJobPosting[]): Promise<number> {
    if (postings.length === 0) return 0;

    const db = getDb();
    const now = new Date();

    for (const p of postings) {
      await db
        .insert(jobPostingsRaw)
        .values({
          source: p.source,
          externalId: p.externalId,
          title: p.title,
          company: p.company,
          city: p.city,
          seniority: p.seniority,
          rawSkills: p.rawSkills,
          salaryMinLpa: p.salaryMinLpa ?? null,
          salaryMaxLpa: p.salaryMaxLpa ?? null,
          postedAt: p.postedAt,
          scrapedAt: now,
        })
        .onConflictDoUpdate({
          target: jobPostingsRaw.externalId,
          set: {
            title: p.title,
            company: p.company,
            city: p.city,
            seniority: p.seniority,
            rawSkills: p.rawSkills,
            salaryMinLpa: p.salaryMinLpa ?? null,
            salaryMaxLpa: p.salaryMaxLpa ?? null,
            postedAt: p.postedAt,
            scrapedAt: now,
          },
        });
    }

    return postings.length;
  }
}
