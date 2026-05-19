#!/usr/bin/env node
/**
 * Fails the build on Vercel when required production env vars are missing.
 * Local `npm run build` is unaffected unless VERCEL=1 is set.
 */
const isVercel = process.env.VERCEL === "1";
const isProd =
  process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

if (!isVercel || !isProd) {
  process.exit(0);
}

const required = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
];

const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.error(
    "\n[validate-production-env] Missing required Vercel Production variables:\n",
  );
  for (const key of missing) console.error(`  - ${key}`);
  console.error(
    "\nSee careeros/DEPLOY.md and careeros/.env.example\n",
  );
  process.exit(1);
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL.trim();
if (!appUrl.includes("aihired.in")) {
  console.error(
    "\n[validate-production-env] NEXT_PUBLIC_APP_URL must be https://aihired.in in production.\n",
  );
  process.exit(1);
}

if (process.env.INTERVIEW_AUDIO_STORAGE === "r2") {
  const r2Keys = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ];
  const missingR2 = r2Keys.filter((key) => !process.env[key]?.trim());
  if (missingR2.length > 0) {
    console.error(
      "\n[validate-production-env] R2 storage selected; missing:\n",
    );
    for (const key of missingR2) console.error(`  - ${key}`);
    process.exit(1);
  }
}

console.log("[validate-production-env] OK");
