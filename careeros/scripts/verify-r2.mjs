import { readFileSync } from "fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const envPath = new URL("../.env.local", import.meta.url);
const text = readFileSync(envPath, "utf8");
for (const line of text.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.R2_BUCKET_NAME?.trim();
const publicUrl = process.env.R2_PUBLIC_URL?.trim();

const issues = [];
if (!accountId) issues.push("R2_ACCOUNT_ID is missing");
if (!accessKeyId) issues.push("R2_ACCESS_KEY_ID is missing");
if (!secretAccessKey) issues.push("R2_SECRET_ACCESS_KEY is missing");
if (!bucket) issues.push("R2_BUCKET_NAME is missing");
if (!publicUrl) issues.push("R2_PUBLIC_URL is missing");
if (accountId && accessKeyId && accountId === accessKeyId) {
  issues.push("R2_ACCESS_KEY_ID must not equal R2_ACCOUNT_ID");
}
if (accessKeyId?.startsWith("cfat_")) {
  issues.push("R2_ACCESS_KEY_ID looks like a Cloudflare API token (cfat_) — use R2 S3 Access Key ID");
}
if (secretAccessKey?.startsWith("cfat_")) {
  issues.push("R2_SECRET_ACCESS_KEY looks like a Cloudflare API token — use R2 S3 Secret Access Key");
}
if (secretAccessKey?.startsWith("https://")) {
  issues.push("R2_SECRET_ACCESS_KEY is an endpoint URL — paste the Secret Access Key from the token screen");
}

console.log("INTERVIEW_AUDIO_STORAGE:", process.env.INTERVIEW_AUDIO_STORAGE || "(not set)");
console.log("R2_ACCOUNT_ID:", accountId ? `set (${accountId.length} chars)` : "MISSING");
console.log("R2_ACCESS_KEY_ID:", accessKeyId ? `set (${accessKeyId.length} chars)` : "MISSING");
console.log("R2_SECRET_ACCESS_KEY:", secretAccessKey ? `set (${secretAccessKey.length} chars)` : "MISSING");
console.log("R2_BUCKET_NAME:", bucket || "MISSING");
console.log("R2_PUBLIC_URL:", publicUrl ? "set" : "MISSING");

if (issues.length > 0) {
  console.log("\nConfiguration issues:");
  for (const issue of issues) console.log("  -", issue);
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const key = "interviews/_connection-test/turn-0.mp3";
try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from("r2-connection-test"),
      ContentType: "audio/mpeg",
    })
  );
  const url = `${publicUrl.replace(/\/$/, "")}/${key}`;
  console.log("\nR2 upload: OK");
  console.log("Public URL pattern:", url.replace(/\/interviews.*/, "/interviews/..."));
  process.exit(0);
} catch (error) {
  console.log("\nR2 upload: FAILED");
  console.log("Error:", error instanceof Error ? error.message : String(error));
  process.exit(2);
}
