import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for CareerOS.
 *
 * Set `DATABASE_URL` in `.env.local` (Supabase → Project Settings → Database →
 * Connection string, "URI" mode). Use the direct or pooler URL for migrations.
 *
 * - `npm run db:generate` — diff schema → SQL under `./drizzle/`
 * - `npm run db:push` — apply schema directly (dev only)
 * - `npm run db:studio` — browse data
 *
 * Production schema changes: apply `../supabase/migrations/*.sql` via
 * `supabase db push` from the repo root (source of truth for Supabase).
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
