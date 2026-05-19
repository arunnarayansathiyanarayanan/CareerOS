import { BaseScraper } from "./base";
import { AdzunaScraper } from "./adzuna";
import { GoogleJobsScraper } from "./googleJobs";
import { LinkedInScraper } from "./linkedin";
import { NaukriScraper } from "./naukri";

export {
  BaseScraper,
  JOB_CITY,
  type JobCity,
  type RawJobPosting,
} from "./base";
export { NaukriScraper } from "./naukri";
export { AdzunaScraper } from "./adzuna";
export { GoogleJobsScraper } from "./googleJobs";
export { LinkedInScraper } from "./linkedin";

export type ScraperRunResult = {
  source: string;
  scraped: number;
  upserted: number;
};

export type ScraperRunFailure = {
  source: string;
  error: string;
};

function scraperLabel(scraper: BaseScraper): string {
  return scraper.source;
}

function buildScrapers(): BaseScraper[] {
  const scrapers: BaseScraper[] = [];

  if (process.env.SKILL_SCRAPER_NAUKRI !== "false") {
    scrapers.push(new NaukriScraper());
  }

  if (
    process.env.ADZUNA_APP_ID?.trim() &&
    process.env.ADZUNA_APP_KEY?.trim()
  ) {
    scrapers.push(new AdzunaScraper());
  }

  if (process.env.RAPIDAPI_KEY?.trim()) {
    scrapers.push(new GoogleJobsScraper());
    scrapers.push(new LinkedInScraper());
  }

  return scrapers;
}

export async function runAllScrapers(): Promise<{
  fulfilled: ScraperRunResult[];
  rejected: ScraperRunFailure[];
}> {
  const scrapers = buildScrapers();

  if (scrapers.length === 0) {
    throw new Error(
      "No scrapers configured. Set ADZUNA_APP_ID/ADZUNA_APP_KEY and/or RAPIDAPI_KEY, " +
        "or enable Naukri with SKILL_SCRAPER_NAUKRI=true (Naukri often returns 0 without browser automation).",
    );
  }

  const settled = await Promise.allSettled(
    scrapers.map(async (scraper) => {
      const source = scraperLabel(scraper);
      const postings = await scraper.scrape();
      const upserted = await scraper.upsertPostings(postings);
      return { source, scraped: postings.length, upserted };
    }),
  );

  const fulfilled: ScraperRunResult[] = [];
  const rejected: ScraperRunFailure[] = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const source = scraperLabel(scrapers[i]!);

    if (result.status === "fulfilled") {
      fulfilled.push(result.value);
      console.info(
        `[scrapers] ${source}: scraped=${result.value.scraped} upserted=${result.value.upserted}`,
      );
    } else {
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      rejected.push({ source, error: message });
      console.error(`[scrapers] ${source} failed:`, message);
    }
  }

  return { fulfilled, rejected };
}
