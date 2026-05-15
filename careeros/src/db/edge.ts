import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@/db/schema";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

let edgeDb: NeonHttpDatabase<typeof schema> | undefined;

/**
 * Edge-safe Drizzle client (HTTP, no TCP pooler).
 * Prefer `DATABASE_URL_UNPOOLED` (direct Postgres host) for Vercel Edge / OG routes.
 */
export function getEdgeDb(): NeonHttpDatabase<typeof schema> {
  if (!edgeDb) {
    const url =
      process.env.DATABASE_URL_UNPOOLED?.trim() ??
      process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error(
        "DATABASE_URL_UNPOOLED or DATABASE_URL is not configured"
      );
    }
    const sql = neon(url);
    edgeDb = drizzle(sql, { schema });
  }
  return edgeDb;
}
