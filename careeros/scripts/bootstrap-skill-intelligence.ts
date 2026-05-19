/**
 * One-time / manual pipeline: migrations → seed → scrape → aggregate.
 *
 *   npx tsx --env-file=.env.local scripts/bootstrap-skill-intelligence.ts
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aggregateDemandSnapshots } from "../src/workers/jobs/aggregateDemand";
import { runAllScrapers } from "../src/workers/scrapers";
import { runSeeds } from "../src/db/seeds";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const MIGRATIONS = [
  "supabase/migrations/20260523_skill_ontology.sql",
  "supabase/migrations/20260524_skill_ontology_requests.sql",
  "supabase/migrations/20260526_skill_intelligence_jobs.sql",
];

async function applyMigrations(): Promise<void> {
  for (const rel of MIGRATIONS) {
    const sqlPath = path.join(repoRoot, rel);
    console.log(`Applying ${rel}...`);
    execSync(
      `npx tsx --env-file=.env.local scripts/apply-migration.ts "${sqlPath}"`,
      { cwd: path.join(repoRoot, "careeros"), stdio: "inherit" },
    );
  }
}

async function main() {
  console.log("=== Skill intelligence bootstrap ===\n");

  await applyMigrations();

  console.log("\nSeeding skill ontology...");
  await runSeeds();

  console.log("\nRunning scrapers...");
  const scrape = await runAllScrapers();
  console.log("Scrape results:", scrape);

  const totalUpserted = scrape.fulfilled.reduce((n, r) => n + r.upserted, 0);
  if (totalUpserted === 0) {
    console.warn(
      "\nNo postings were ingested. Add API keys to .env.local:\n" +
        "  ADZUNA_APP_ID / ADZUNA_APP_KEY — https://developer.adzuna.com/\n" +
        "  RAPIDAPI_KEY — https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch\n",
    );
  }

  console.log("\nAggregating demand snapshots...");
  await aggregateDemandSnapshots();

  console.log("\nDone. Refresh /skills to see data.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
