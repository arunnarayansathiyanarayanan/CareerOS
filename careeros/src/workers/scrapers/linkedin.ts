import { JSearchScraper, isLinkedInJob } from "./jsearch";

const QUERIES = [
  "AI engineer India",
  "machine learning India",
  "AI product manager India",
] as const;

/** LinkedIn-sourced listings via JSearch (RapidAPI). Requires RAPIDAPI_KEY. */
export class LinkedInScraper extends JSearchScraper {
  constructor() {
    super({
      source: "linkedin",
      externalPrefix: "linkedin",
      queries: [...QUERIES],
      filter: isLinkedInJob,
    });
  }
}
