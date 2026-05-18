/**
 * Database seed runner.
 *
 * Run from the `careeros` directory:
 *   npx tsx --env-file=.env.local scripts/seed.ts
 */

import { runSeeds } from "../src/db/seeds";

async function main() {
  await runSeeds();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
