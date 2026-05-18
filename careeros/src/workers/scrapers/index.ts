import { BaseScraper } from "./base";
import { NaukriScraper } from "./naukri";

export {
  BaseScraper,
  JOB_CITY,
  type JobCity,
  type RawJobPosting,
} from "./base";
export { NaukriScraper } from "./naukri";

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

export async function runAllScrapers(): Promise<{
  fulfilled: ScraperRunResult[];
  rejected: ScraperRunFailure[];
}> {
  const scrapers: BaseScraper[] = [new NaukriScraper()];

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
