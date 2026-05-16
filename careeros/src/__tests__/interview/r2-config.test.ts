import { afterEach, describe, expect, it } from "vitest";

import {
  getInterviewAudioStorage,
  getR2ConfigIssues,
  isR2Configured,
} from "@/lib/storage/r2-config";

const ENV_KEYS = [
  "INTERVIEW_AUDIO_STORAGE",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
});

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!(key in saved)) {
    saved[key] = process.env[key];
  }
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("r2-config", () => {
  it("detects access key copied from account id", () => {
    setEnv("R2_ACCOUNT_ID", "abc123");
    setEnv("R2_ACCESS_KEY_ID", "abc123");
    setEnv("R2_SECRET_ACCESS_KEY", "real-secret");
    setEnv("R2_BUCKET_NAME", "bucket");
    setEnv("R2_PUBLIC_URL", "https://pub.example.r2.dev");

    expect(isR2Configured()).toBe(false);
    expect(getR2ConfigIssues().join(" ")).toMatch(/not your Cloudflare account ID/i);
  });

  it("detects cfat_ Cloudflare API token used as secret", () => {
    setEnv("R2_ACCOUNT_ID", "abc123");
    setEnv("R2_ACCESS_KEY_ID", "different-key");
    setEnv("R2_SECRET_ACCESS_KEY", "cfat_abc");
    setEnv("R2_BUCKET_NAME", "bucket");
    setEnv("R2_PUBLIC_URL", "https://pub.example.r2.dev");

    expect(getR2ConfigIssues().join(" ")).toMatch(/S3 API token/i);
  });

  it("prefers r2 when INTERVIEW_AUDIO_STORAGE=r2 and config is valid", () => {
    setEnv("INTERVIEW_AUDIO_STORAGE", "r2");
    setEnv("R2_ACCOUNT_ID", "abc123");
    setEnv("R2_ACCESS_KEY_ID", "key-id");
    setEnv("R2_SECRET_ACCESS_KEY", "secret");
    setEnv("R2_BUCKET_NAME", "bucket");
    setEnv("R2_PUBLIC_URL", "https://pub.example.r2.dev");

    expect(getInterviewAudioStorage()).toBe("r2");
    expect(isR2Configured()).toBe(true);
  });
});
