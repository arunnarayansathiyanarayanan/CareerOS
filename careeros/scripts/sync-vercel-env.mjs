#!/usr/bin/env node
/**
 * Push env vars from .env.local to a Vercel project (Production).
 * Requires: `npx vercel login` and `npx vercel link` in careeros/
 *
 * Usage: node scripts/sync-vercel-env.mjs
 * Skips empty values and comments. Does not print secret values.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

if (!existsSync(envPath)) {
  console.error("Missing .env.local — create it from .env.example");
  process.exit(1);
}

const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
const vars = {};

for (const line of lines) {
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
  if (!value) {
    console.warn(`skip (empty): ${key}`);
    continue;
  }
  vars[key] = value;
}

const keys = Object.keys(vars);
console.log(`Syncing ${keys.length} variables to Vercel (production)...`);

for (const key of keys) {
  const value = vars[key];
  try {
    execSync(
      `npx vercel env add "${key}" production --force`,
      {
        cwd: root,
        input: value,
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf8",
      },
    );
    console.log(`ok: ${key}`);
  } catch (e) {
    console.error(`failed: ${key}`, e.stderr?.toString?.() ?? e.message);
  }
}

console.log("Done. Redeploy: npx vercel --prod");
