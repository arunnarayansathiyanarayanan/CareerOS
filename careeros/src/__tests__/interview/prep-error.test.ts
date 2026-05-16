import { describe, expect, it } from "vitest";

import { TTSError } from "@/lib/ai/errors";
import { formatInterviewPrepError } from "@/lib/interviews/prep-error";
import { StorageError } from "@/lib/storage/r2";
import { R2ConfigError } from "@/lib/storage/r2-config";

describe("formatInterviewPrepError", () => {
  it("maps TTS failures", () => {
    expect(
      formatInterviewPrepError(new TTSError("synthesis_failed", "api down"))
    ).toMatch(/OPENAI_API_KEY/i);
  });

  it("maps R2 config errors", () => {
    expect(
      formatInterviewPrepError(
        new R2ConfigError("R2_ACCESS_KEY_ID must be the S3 API token access key")
      )
    ).toMatch(/S3 API token/i);
  });

  it("maps R2 auth failures", () => {
    expect(
      formatInterviewPrepError(
        new StorageError("key", "upload failed", {
          cause: new Error("Access Denied"),
        })
      )
    ).toMatch(/R2 rejected/i);
  });
});
