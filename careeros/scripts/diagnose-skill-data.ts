/**
 * Quick skill-intelligence pipeline check.
 * npx tsx --env-file=.env.local scripts/diagnose-skill-data.ts
 */

import { sql } from "drizzle-orm";

import { getDb } from "../src/db/client";
import { NaukriScraper } from "../src/workers/scrapers/naukri";

async function main() {
  const db = getDb();

  try {
    const counts = await db.execute<{
      ontology: number;
      postings: number;
      snapshots: number;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM skill_ontology) AS ontology,
        (SELECT count(*)::int FROM job_postings_raw) AS postings,
        (SELECT count(*)::int FROM skill_demand_snapshots) AS snapshots
    `);
    console.log("DB counts:", counts.rows[0]);
  } catch (err) {
    console.error("DB query failed (tables missing?):", err);
  }

  console.log("\nTesting Naukri scrape (no DB write)...");
  const scraper = new NaukriScraper();
  const jobs = await scraper.scrape();
  console.log(`Naukri scraped: ${jobs.length} jobs`);
  if (jobs[0]) {
    console.log("Sample:", jobs[0].title, "@", jobs[0].company, jobs[0].city);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
