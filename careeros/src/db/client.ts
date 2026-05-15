import dns from "node:dns";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import type { DrizzleDB } from "@/db/types";

let pool: Pool | undefined;
let db: DrizzleDB | undefined;
let supabaseIpv6DnsApplied = false;

/**
 * Supabase **direct** DB host (`db.<ref>.supabase.co`) is often IPv6-only on free tier.
 * Node defaults to IPv4-first DNS ordering; prefer IPv6 so `pg` resolves a usable address.
 * Pooler hosts (`*.pooler.supabase.com`) are skipped. Set `DATABASE_IPV6_FIRST=0` to disable.
 */
function applySupabaseDirectIpv6Preference(connectionString: string) {
  if (supabaseIpv6DnsApplied || process.env.DATABASE_IPV6_FIRST === "0") return;
  if (typeof dns.setDefaultResultOrder !== "function") return;
  if (!connectionString.includes("@db.") || !connectionString.includes(".supabase.co")) {
    return;
  }
  dns.setDefaultResultOrder("ipv6first");
  supabaseIpv6DnsApplied = true;
}

export function getDb(): DrizzleDB {
  if (!db) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error("DATABASE_URL is not configured");
    }
    applySupabaseDirectIpv6Preference(url);
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  }
  return db;
}
