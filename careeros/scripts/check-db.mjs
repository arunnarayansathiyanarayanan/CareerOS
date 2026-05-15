/**
 * Verifies DATABASE_URL (same IPv6-first behavior as src/db/client.ts for direct Supabase).
 * Run: npm run db:ping
 */
import dns from "node:dns";
import pg from "pg";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("FAIL: DATABASE_URL is missing or empty");
  process.exit(1);
}

if (
  url.includes("@db.") &&
  url.includes(".supabase.co") &&
  process.env.DATABASE_IPV6_FIRST !== "0" &&
  typeof dns.setDefaultResultOrder === "function"
) {
  dns.setDefaultResultOrder("ipv6first");
}

const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 25000 });

try {
  const { rows } = await pool.query(
    "SELECT current_database() AS db, inet_server_addr()::text AS server_addr"
  );
  console.log("OK: Postgres is reachable");
  console.log("database:", rows[0].db);
  if (rows[0].server_addr) {
    console.log("server_addr:", rows[0].server_addr);
  }
} catch (e) {
  const err = /** @type {Error & { code?: string }} */ (e);
  console.error("FAIL:", err.code ?? "", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
