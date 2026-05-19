import { JSearchScraper, isGoogleJob, isLinkedInJob } from "./jsearch";

const QUERIES = [
  "AI engineer India",
  "machine learning India",
  "generative AI India",
] as const;

/** Google Jobs listings via JSearch (RapidAPI). Requires RAPIDAPI_KEY. */
export class GoogleJobsScraper extends JSearchScraper {
  constructor() {
    super({
      source: "google",
      externalPrefix: "google",
      queries: [...QUERIES],
      filter: (job) => isGoogleJob(job) || !isLinkedInJob(job),
    });
  }
}
