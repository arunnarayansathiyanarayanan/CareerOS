import { describe, expect, it, vi } from "vitest";

import { checkInterviewQuota } from "@/lib/interviews/rate-limit";

function createQuotaSupabase(sessionsUsed: number) {
  return {
    rpc: vi.fn(async () => ({
      data: {
        id: "quota-1",
        user_id: "user-1",
        week_start: "2026-05-11",
        sessions_used: sessionsUsed,
      },
      error: null,
    })),
  };
}

describe("checkInterviewQuota", () => {
  it("allows free user with 0 sessions used", async () => {
    const supabase = createQuotaSupabase(0);
    const result = await checkInterviewQuota("user-1", supabase as never, false);
    expect(result).toEqual({ allowed: true });
  });

  it("denies free user with 1 session used and returns resetAt", async () => {
    const supabase = createQuotaSupabase(1);
    const result = await checkInterviewQuota("user-1", supabase as never, false);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.sessionsUsed).toBe(1);
      expect(result.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("allows pro user regardless of session count", async () => {
    const supabase = createQuotaSupabase(10);
    const result = await checkInterviewQuota("user-1", supabase as never, true);
    expect(result).toEqual({ allowed: true });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
