export type InterviewAudioStorage = "r2" | "supabase";

export class R2ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2ConfigError";
    Object.setPrototypeOf(this, R2ConfigError.prototype);
  }
}

/** Which backend stores interview turn audio. Default: r2 when valid R2 env is set. */
export function getInterviewAudioStorage(): InterviewAudioStorage {
  const pref = process.env.INTERVIEW_AUDIO_STORAGE?.trim().toLowerCase();
  if (pref === "supabase") return "supabase";
  if (pref === "r2") return "r2";
  return isR2Configured() ? "r2" : "supabase";
}

export function usesR2ForInterviewAudio(): boolean {
  return getInterviewAudioStorage() === "r2";
}

/** Returns human-readable issues with the current R2 env (empty = OK). */
export function getR2ConfigIssues(): string[] {
  const issues: string[] = [];
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim();

  if (!accountId) issues.push("R2_ACCOUNT_ID is missing");
  if (!accessKeyId) issues.push("R2_ACCESS_KEY_ID is missing");
  if (!secretAccessKey) issues.push("R2_SECRET_ACCESS_KEY is missing");
  if (!bucket) issues.push("R2_BUCKET_NAME is missing");
  if (!publicUrl) issues.push("R2_PUBLIC_URL is missing");

  if (accountId && accessKeyId && accountId === accessKeyId) {
    issues.push(
      "R2_ACCESS_KEY_ID must be the S3 API token access key, not your Cloudflare account ID"
    );
  }

  if (secretAccessKey?.startsWith("cfat_")) {
    issues.push(
      "R2_SECRET_ACCESS_KEY looks like a Cloudflare API token — create an R2 S3 API token instead (R2 → Manage R2 API Tokens → Create API token with Object Read & Write)"
    );
  }

  return issues;
}

export function isR2Configured(): boolean {
  return getR2ConfigIssues().length === 0;
}

export function assertR2Configured(): void {
  const issues = getR2ConfigIssues();
  if (issues.length > 0) {
    throw new R2ConfigError(
      `R2 is not configured correctly:\n• ${issues.join("\n• ")}`
    );
  }
}
