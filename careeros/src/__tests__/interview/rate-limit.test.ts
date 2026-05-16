import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkInterviewQuota } from "@/lib/interviews/rate-limit";

vi.mock("@/lib/interviews/quota", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/interviews/quota")>();
  return {
    ...actual,
    getWeeklySessionsUsed: vi.fn(),
  };
});

import { getWeeklySessionsUsed } from "@/lib/interviews/quota";

const getWeeklySessionsUsedMock = vi.mocked(getWeeklySessionsUsed);

describe("checkInterviewQuota", () => {
  beforeEach(() => {
    getWeeklySessionsUsedMock.mockReset();
  });

  it("allows free user with 0 sessions used", async () => {
    getWeeklySessionsUsedMock.mockResolvedValueOnce(0);
    const result = await checkInterviewQuota("user-1", {} as never, false);
    expect(result).toEqual({ allowed: true });
  });

  it("denies free user with 1 session used and returns resetAt", async () => {
    getWeeklySessionsUsedMock.mockResolvedValueOnce(1);
    const result = await checkInterviewQuota("user-1", {} as never, false);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.sessionsUsed).toBe(1);
      expect(result.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("allows pro user regardless of session count", async () => {
    getWeeklySessionsUsedMock.mockClear();
    const result = await checkInterviewQuota("user-1", {} as never, true);
    expect(result).toEqual({ allowed: true });
    expect(getWeeklySessionsUsedMock).not.toHaveBeenCalled();
  });
});
