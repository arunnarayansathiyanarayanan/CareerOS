/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  userId: "00000000-0000-0000-0000-000000000001",
}));

const quotaState = vi.hoisted(() => ({
  sessionsUsed: 0,
  isPro: false,
}));

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(async () => ({
    userId: authState.userId,
    supabase: supabaseMock as never,
  })),
  authErrorResponse: (error: unknown) =>
    error instanceof Response ? error : null,
}));

vi.mock("@/lib/interviews/quota", () => ({
  FREE_TIER_WEEKLY_SESSION_LIMIT: 1,
  isPaidInterviewTier: vi.fn(async () => quotaState.isPro),
  hasFreeWeeklyQuotaRemaining: vi.fn(async () => quotaState.sessionsUsed < 1),
  getOrCreateWeeklyQuota: vi.fn(async () => ({
    id: "quota-row",
    user_id: authState.userId,
    week_start: "2026-05-11",
    sessions_used: quotaState.sessionsUsed,
  })),
  incrementWeeklyQuotaUsed: vi.fn(async () => undefined),
  deleteInterviewSession: vi.fn(async () => undefined),
  getNextMondayResetIso: () => "2026-05-18T00:00:00.000Z",
}));

vi.mock("@/lib/interviews/projects", () => ({
  validateProjectContextIds: vi.fn(async () => ({ ok: true, ids: [] })),
}));

vi.mock("@/lib/ai/tts", () => ({
  synthesizeSpeech: vi.fn(async () => Buffer.from("audio")),
}));

vi.mock("@/lib/storage/interview-audio", () => ({
  uploadInterviewAudio: vi.fn(async () => "https://cdn.example/audio.mp3"),
}));

vi.mock("@/lib/ai/openai-client", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

function mockSessionInsert() {
  const single = vi.fn(async () => ({
    data: { id: "session-abc-123" },
    error: null,
  }));
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const eqUser = vi.fn(async () => ({ error: null }));
  const eqId = vi.fn(() => ({ eq: eqUser }));
  const update = vi.fn(() => ({ eq: eqId }));
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === "interview_sessions") {
      return { insert, update };
    }
    return {};
  });
  return { insert, single, update };
}

describe("POST /api/interviews/start", () => {
  beforeEach(() => {
    vi.resetModules();
    quotaState.sessionsUsed = 0;
    quotaState.isPro = false;
    supabaseMock.from.mockReset();
  });

  it("returns 400 when subMode is missing", async () => {
    const { POST } = await import("@/app/api/interviews/start/route");
    const res = await POST(
      new Request("http://localhost/api/interviews/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track: "ai_pm" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/subMode/i);
  });

  it("returns 200 with sessionId for a valid request", async () => {
    mockSessionInsert();
    const { POST } = await import("@/app/api/interviews/start/route");
    const res = await POST(
      new Request("http://localhost/api/interviews/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: "ai_pm",
          subMode: "product_sense",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe("session-abc-123");
    expect(body.totalTurns).toBeGreaterThan(0);
    expect(body.openingQuestion).toEqual(expect.any(String));
  });

  it("cleans up the session when opening audio fails", async () => {
    const { synthesizeSpeech } = await import("@/lib/ai/tts");
    const { deleteInterviewSession } = await import("@/lib/interviews/quota");
    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(new Error("tts down"));
    mockSessionInsert();

    const { POST } = await import("@/app/api/interviews/start/route");
    const res = await POST(
      new Request("http://localhost/api/interviews/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: "ai_pm",
          subMode: "product_sense",
        }),
      })
    );

    expect(res.status).toBe(502);
    expect(vi.mocked(deleteInterviewSession)).toHaveBeenCalledWith(
      expect.anything(),
      "session-abc-123",
      authState.userId
    );
  });

  it("returns 429 with resetAt when free tier is at limit", async () => {
    quotaState.sessionsUsed = 1;
    const { POST } = await import("@/app/api/interviews/start/route");
    const res = await POST(
      new Request("http://localhost/api/interviews/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: "ai_pm",
          subMode: "product_sense",
        }),
      })
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("weekly_limit_reached");
    expect(body.resetAt).toBe("2026-05-18T00:00:00.000Z");
  });
});
