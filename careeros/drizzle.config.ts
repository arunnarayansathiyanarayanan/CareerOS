import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for CareerOS.
 *
 * Set `DATABASE_URL` in `.env.local` (Supabase → Project Settings → Database →
 * Connection string, "URI" mode). Required at runtime for Next.js routes that use
 * `getDb()` as well as for `db:*` scripts below.
 *
 * - `npm run db:generate` — diff schema → SQL under `./drizzle/`
 * - `npm run db:push` — apply schema directly (dev only)
 * - `npm run db:studio` — browse data
 *
 * Production schema changes: apply `../supabase/migrations/*.sql` via
 * `supabase db push` from the repo root (source of truth for Supabase).
 *
 * **IPv6-only direct DB:** If `DATABASE_URL` uses `db.*.supabase.co` and
 * `drizzle-kit` cannot connect, run with IPv6-first DNS, e.g.
 * `set NODE_OPTIONS=--dns-result-order=ipv6first` (Windows) before `npm run db:push`.
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
