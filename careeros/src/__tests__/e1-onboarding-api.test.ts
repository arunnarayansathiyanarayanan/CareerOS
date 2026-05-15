/** @jest-environment node */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockAuth = jest.fn(async () => ({ userId: null as string | null }));

jest.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  currentUser: jest.fn(),
}));

function mockSupabaseForResumeRoute(uploadCount = 0) {
  return {
    from: (table: string) => {
      if (table === "resume_upload_events") {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({ count: uploadCount, error: null }),
            }),
          }),
        };
      }
      return {};
    },
  };
}

describe("Onboarding API routes without Clerk session", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ userId: null });
  });

  it("returns 401 for GET and PATCH /api/onboarding/progress", async () => {
    const { GET, PATCH } = await import("@/app/api/onboarding/progress/route");
    const getRes = await GET();
    expect(getRes.status).toBe(401);

    const patchRes = await PATCH(
      new Request("http://localhost/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 2, data: {} }),
      })
    );
    expect(patchRes.status).toBe(401);
  });

  it("returns 401 for POST /api/onboarding/complete", async () => {
    const { POST } = await import("@/app/api/onboarding/complete/route");
    const res = await POST(
      new Request("http://localhost/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole: "ai_engineer",
          yearsOfExperience: "1-3",
          aiFluency: "not_started",
        }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for POST /api/onboarding/resume", async () => {
    const { POST } = await import("@/app/api/onboarding/resume/route");
    const fd = new FormData();
    fd.append("resume", new File(["x"], "r.pdf", { type: "application/pdf" }));
    const res = await POST(
      new Request("http://localhost/api/onboarding/resume", {
        method: "POST",
        body: fd,
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("Resume upload validation (authenticated)", () => {
  beforeEach(() => {
    jest.resetModules();
    mockAuth.mockResolvedValue({ userId: "clerk_test_user" });
    jest.doMock("@supabase/supabase-js", () => ({
      createClient: jest.fn(() => mockSupabaseForResumeRoute(0)),
    }));
  });

  it("rejects .txt and image/jpeg MIME types", async () => {
    const { POST } = await import("@/app/api/onboarding/resume/route");

    const txtRes = await POST(
      new Request("http://localhost/api/onboarding/resume", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.append(
            "resume",
            new File(["hello"], "cv.txt", { type: "text/plain" })
          );
          return fd;
        })(),
      })
    );
    expect(txtRes.status).toBe(400);
    const txtBody = (await txtRes.json()) as { code: string };
    expect(txtBody.code).toBe("INVALID_FILE_TYPE");

    const jpgRes = await POST(
      new Request("http://localhost/api/onboarding/resume", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.append(
            "resume",
            new File([new Uint8Array([1, 2, 3])], "x.jpg", {
              type: "image/jpeg",
            })
          );
          return fd;
        })(),
      })
    );
    expect(jpgRes.status).toBe(400);
    const jpgBody = (await jpgRes.json()) as { code: string };
    expect(jpgBody.code).toBe("INVALID_FILE_TYPE");
  });

  it("rejects files over 5MB", async () => {
    const { POST } = await import("@/app/api/onboarding/resume/route");
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", {
      type: "application/pdf",
    });
    const fd = new FormData();
    fd.append("resume", big);
    const res = await POST(
      new Request("http://localhost/api/onboarding/resume", {
        method: "POST",
        body: fd,
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("FILE_TOO_LARGE");
  });
});
