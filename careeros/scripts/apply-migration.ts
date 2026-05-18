/**
 * Apply a single SQL migration file using DATABASE_URL.
 *
 *   npx tsx --env-file=.env.local scripts/apply-migration.ts ../supabase/migrations/20260523_skill_ontology.sql
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const relPath = process.argv[2];
if (!relPath) {
  console.error("Usage: apply-migration.ts <path-to.sql>");
  process.exit(1);
}

const sqlPath = path.resolve(__dirname, relPath);
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not configured");
  process.exit(1);
}

async function main() {
  const sql = fs.readFileSync(sqlPath, "utf8");
  const pool = new pg.Pool({ connectionString: url });
  try {
    await pool.query(sql);
    console.log(`OK: applied ${path.basename(sqlPath)}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
