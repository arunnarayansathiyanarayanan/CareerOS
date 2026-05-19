#!/usr/bin/env node
/** Push .env.local to Vercel Production with production overrides. */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

if (!existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const vars = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (value) vars[key] = value;
}

vars.NEXT_PUBLIC_APP_URL = "https://aihired.in";
if (!vars.CRON_SECRET?.trim()) {
  vars.CRON_SECRET = randomBytes(32).toString("hex");
  console.log("Generated CRON_SECRET for production");
}

for (const [key, value] of Object.entries(vars)) {
  try {
    execSync(`npx vercel env add "${key}" production --force`, {
      cwd: root,
      input: value,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    });
    console.log(`ok: ${key}`);
  } catch (e) {
    console.error(`failed: ${key}`, e.stderr?.toString?.() ?? e.message);
    process.exit(1);
  }
}

console.log("Production env synced.");
