import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import type { DrizzleDB } from "@/db/types";

let pool: Pool | undefined;
let db: DrizzleDB | undefined;

export function getDb(): DrizzleDB {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not configured");
    }
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  }
  return db;
}
