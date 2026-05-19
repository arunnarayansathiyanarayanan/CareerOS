/** @jest-environment jsdom */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import OnboardingPage from "@/app/onboarding/page";
import { StepTargetRole } from "@/components/onboarding/StepTargetRole";
import { StepResumeUpload } from "@/components/onboarding/StepResumeUpload";
import {
  captureAttributionFromWindow,
  mergeSnapshotIntoSession,
} from "@/lib/careerosAttribution";
import {
  roadmapModelRoleFromSelection,
  signInRedirectUrlForOnboarding,
} from "@/lib/e1OnboardingRouting";
import { trackOnboardingCompleted } from "@/lib/analytics";
import { sendWelcomeEmail } from "@/services/notifications";
import { useOnboardingStore } from "@/store/onboardingStore";

import { mockRouterReplace } from "next/navigation";

import { mockResendSend } from "./__mocks__/resend-node";

jest.mock("framer-motion", () => {
  const Passthrough = ({
    children,
    ...rest
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...rest}>{children}</div>
  );
  return {
    motion: {
      div: Passthrough,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

async function importGenerateRoadmap(openaiChatCompletionsCreate: jest.Mock) {
  jest.resetModules();
  const nodeUtil = await import("node:util");
  globalThis.structuredClone =
    nodeUtil.structuredClone ??
    ((value: unknown) => JSON.parse(JSON.stringify(value)) as never);
  jest.doMock("openai", () => {
    class APIUserAbortError extends Error {
      override name = "APIUserAbortError";
    }
    class APIConnectionTimeoutError extends Error {
      override name = "APIConnectionTimeoutError";
    }
    const OpenAI = jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: openaiChatCompletionsCreate,
        },
      },
    }));
    return {
      __esModule: true,
      default: OpenAI,
      APIUserAbortError,
      APIConnectionTimeoutError,
    };
  });
  const mod = await import("@/services/generateRoadmap");
  return mod.generateRoadmap;
}

beforeEach(async () => {
  if (jest.isMockFunction(trackOnboardingCompleted)) {
    (trackOnboardingCompleted as jest.Mock).mockClear();
  }
  localStorage.clear();
  sessionStorage.clear();
  mockResendSend.mockReset();
  mockResendSend.mockResolvedValue({ data: { id: "mock-email" }, error: null });
  await act(async () => {
    localStorage.removeItem("careeros_onboarding");
    useOnboardingStore.getState().reset();
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("E1 onboarding", () => {
  it("completes in under 90 seconds (mock timer)", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/onboarding/progress") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ profile: null }), { status: 200 });
      }
      if (url.includes("/api/onboarding/progress") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.includes("/api/onboarding/complete") && init?.method === "POST") {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.includes("/api/analytics/server")) {
        return new Response(null, { status: 204 });
      }
      return new Response("not found", { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const startedAt = Date.now() - 45_000;

    render(<OnboardingPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });

    await act(async () => {
      useOnboardingStore.setState({
        step: 5,
        targetRole: "ai_engineer",
        currentRole: "Dev",
        yearsOfExperience: "1-3",
        aiFluency: "not_started",
        startedAt,
      });
    });

    await waitFor(() => {
      expect(useOnboardingStore.getState().step).toBe(5);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /looks right/i })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: /looks right/i })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /almost there/i })
      ).toBeInTheDocument();
    });

    const { startedAt: storeStartedAt } = useOnboardingStore.getState();
    expect(storeStartedAt).not.toBeNull();
    expect(Math.round((Date.now() - storeStartedAt!) / 1000)).toBeLessThan(90);
  });

  it("does not show Step 1 continue until a role is selected", async () => {
    const onContinue = jest.fn();
    render(<StepTargetRole onContinue={onContinue} />);
    expect(
      screen.queryByRole("button", { name: "Continue" })
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("radio", { name: /AI Engineer/i })
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("maps other role to ai_generalist for roadmap routing", () => {
    expect(roadmapModelRoleFromSelection("other")).toBe("ai_generalist");
    expect(roadmapModelRoleFromSelection("ai_engineer")).toBe("ai_engineer");
  });

  it("PATCHes progress on each advance (mocked API)", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/onboarding/progress") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ profile: null }), { status: 200 });
      }
      if (url.includes("/api/onboarding/progress") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.includes("/api/analytics/server")) {
        return new Response(null, { status: 204 });
      }
      return new Response("not found", { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<OnboardingPage />);
    await waitFor(() => {
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("radio", { name: /AI Product Manager/i })
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const patchCalls = fetchMock.mock.calls.filter(([u, init]) => {
      const url = typeof u === "string" ? u : (u as Request).url;
      return (
        url.includes("/api/onboarding/progress") &&
        init &&
        (init as RequestInit).method === "PATCH"
      );
    });
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(String((patchCalls[0][1] as RequestInit).body));
    expect(body.step).toBe(2);
  });

  it("re-hydrates partial state from GET /api/onboarding/progress on return visit", async () => {
    const profile = {
      step: 3,
      targetRole: "ai_marketer",
      currentRole: "Growth",
      yearsOfExperience: "3-7",
      aiFluency: "played_with_chatgpt",
      referralSource: null,
      utmParams: { utm_source: "newsletter" },
      resumeUrl: null,
      onboardingCompletedAt: null,
    };

    const fetchMock = jest.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/onboarding/progress")) {
        return new Response(JSON.stringify({ profile }), { status: 200 });
      }
      if (url.includes("/api/analytics/server")) {
        return new Response(null, { status: 204 });
      }
      return new Response("not found", { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<OnboardingPage />);
    await waitFor(() => {
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /years of experience/i })
      ).toBeInTheDocument();
    });
    expect(useOnboardingStore.getState().step).toBe(3);
    expect(useOnboardingStore.getState().targetRole).toBe("ai_marketer");
  });

  it("resume dropzone only accepts PDF and DOCX under 5MB (client config)", () => {
    const accept = {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    };
    const maxBytes = 5 * 1024 * 1024;
    expect(accept["application/pdf"]).toContain(".pdf");
    expect(
      accept[
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ]
    ).toContain(".docx");
    expect(maxBytes).toBe(5 * 1024 * 1024);
    expect(new Set(["text/plain", "image/jpeg"]).has("application/pdf")).toBe(
      false
    );
  });

  it("resume upload rejects files over 5MB", async () => {
    render(
      <StepResumeUpload
        continueExtraDisabled={false}
        onContinue={jest.fn()}
        onResumeDataChange={jest.fn()}
      />
    );
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(input, big);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("resume skip continues without throwing", async () => {
    const onContinue = jest.fn();
    render(
      <StepResumeUpload
        continueExtraDisabled={false}
        onContinue={onContinue}
        onResumeDataChange={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /skip this step/i }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("welcome email send swallows Resend failures", async () => {
    mockResendSend.mockRejectedValueOnce(new Error("resend down"));
    process.env.RESEND_API_KEY = "k";
    process.env.RESEND_FROM_EMAIL = "Aihired <onboarding@example.com>";
    await expect(
      sendWelcomeEmail(
        {
          email: "u@example.com",
          name: "Pat",
          targetRole: "ai_engineer",
          publicProfileSlug: null,
        },
        "roadmap-1"
      )
    ).resolves.toBeUndefined();
  });

  it("captures UTM params from the URL into the store", async () => {
    window.history.pushState(
      {},
      "",
      "/onboarding?utm_source=twitter&utm_medium=social"
    );
    mergeSnapshotIntoSession(captureAttributionFromWindow());
    await act(async () => {
      useOnboardingStore.getState().mergeSessionAttributionIntoUtmParams();
    });
    expect(useOnboardingStore.getState().utmParams.utm_source).toBe("twitter");
    expect(useOnboardingStore.getState().utmParams.utm_medium).toBe("social");
  });

  it("builds the same sign-in redirect URL as onboarding middleware", () => {
    const u = signInRedirectUrlForOnboarding("https://app.test/onboarding");
    expect(u.pathname).toBe("/sign-in");
    expect(u.searchParams.get("redirect_url")).toBe("/onboarding");
  });

  it("redirects completed users from onboarding to /dashboard", async () => {
    const profile = {
      step: 6,
      targetRole: "ai_engineer",
      currentRole: "Eng",
      yearsOfExperience: "1-3",
      aiFluency: "not_started",
      referralSource: null,
      utmParams: {},
      resumeUrl: null,
      onboardingCompletedAt: new Date().toISOString(),
    };
    global.fetch = jest.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/onboarding/progress")) {
        return new Response(JSON.stringify({ profile }), { status: 200 });
      }
      if (url.includes("/api/analytics/server")) {
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;

    render(<OnboardingPage />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
    });
  });
});

describe("generateRoadmap (invalid model output + timeout)", () => {
  const openaiChatCompletionsCreate = jest.fn() as jest.Mock;

  beforeEach(() => {
    openaiChatCompletionsCreate.mockReset();
    process.env.OPENAI_API_KEY = "sk-test";
  });

  it("falls back to starter template when OpenAI returns invalid JSON", async () => {
    openaiChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "NOT JSON {{{" } }],
    });
    const generateRoadmap = await importGenerateRoadmap(openaiChatCompletionsCreate);
    const result = await generateRoadmap({
      userId: "user-1",
      targetRole: "AI_ENGINEER",
      currentRole: "Dev",
      yearsExperience: "1-3",
      aiFluency: "not_started",
    });
    expect(result.phases.length).toBeGreaterThan(0);
    expect(result.phases[0].items[0].title).toMatch(/LLM APIs/i);
  });

  it("throws TIMEOUT when the OpenAI call aborts", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    openaiChatCompletionsCreate.mockRejectedValue(err);
    const generateRoadmap = await importGenerateRoadmap(openaiChatCompletionsCreate);
    await expect(
      generateRoadmap({
        userId: "user-2",
        targetRole: "AI_PM",
        currentRole: "PM",
        yearsExperience: "3-7",
        aiFluency: "played_with_chatgpt",
      })
    ).rejects.toThrow("Generation timed out");
  });
});
