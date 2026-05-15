"use client";

import { track as vercelTrack } from "@vercel/analytics";

export type OnboardingStartedProps = {
  referralSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
};

export type OnboardingStepCompletedProps = {
  step: number;
  stepName: string;
  timeOnStep: number;
};

export type OnboardingRoleSelectedProps = {
  targetRole: string;
};

export type OnboardingResumeUploadedProps = {
  skillsExtracted: number;
  parseSuccess: boolean;
};

export type OnboardingCompletedProps = {
  targetRole: string;
  yearsOfExperience: string;
  aiFluency: string;
  resumeUploaded: boolean;
  totalTimeSeconds: number;
  roadmapGeneratedMs: number;
};

export type RoadmapGenerationFailedProps = {
  fallbackUsed: boolean;
  errorCode: string;
};

const SERVER_CRITICAL = new Set([
  "onboarding_started",
  "onboarding_completed",
  "roadmap_generation_failed",
]);

function mirrorToServer(event: string, properties: Record<string, unknown>) {
  if (typeof window === "undefined" || !SERVER_CRITICAL.has(event)) return;
  try {
    void fetch("/api/analytics/server", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, properties }),
      keepalive: true,
    });
  } catch {
    /* non-blocking */
  }
}

export function trackOnboardingStarted(props: OnboardingStartedProps) {
  const payload = {
    referralSource: props.referralSource ?? "",
    utmSource: props.utmSource ?? "",
    utmMedium: props.utmMedium ?? "",
  };
  vercelTrack("onboarding_started", payload);
  mirrorToServer("onboarding_started", payload);
}

export function trackOnboardingStepCompleted(props: OnboardingStepCompletedProps) {
  vercelTrack("onboarding_step_completed", {
    step: props.step,
    stepName: props.stepName,
    timeOnStep: Math.round(props.timeOnStep),
  });
}

export function trackOnboardingRoleSelected(props: OnboardingRoleSelectedProps) {
  vercelTrack("onboarding_role_selected", {
    targetRole: props.targetRole,
  });
}

export function trackOnboardingResumeUploaded(
  props: OnboardingResumeUploadedProps
) {
  vercelTrack("onboarding_resume_uploaded", {
    skillsExtracted: props.skillsExtracted,
    parseSuccess: props.parseSuccess,
  });
}

export function trackOnboardingResumeSkipped() {
  vercelTrack("onboarding_resume_skipped", {});
}

export function trackOnboardingCompleted(props: OnboardingCompletedProps) {
  const payload = {
    targetRole: props.targetRole,
    yearsOfExperience: props.yearsOfExperience,
    aiFluency: props.aiFluency,
    resumeUploaded: props.resumeUploaded,
    totalTimeSeconds: props.totalTimeSeconds,
    roadmapGeneratedMs: Math.round(props.roadmapGeneratedMs),
  };
  vercelTrack("onboarding_completed", payload);
  mirrorToServer("onboarding_completed", payload);
}

export function trackRoadmapGenerationFailed(props: RoadmapGenerationFailedProps) {
  const payload = {
    fallbackUsed: props.fallbackUsed,
    errorCode: props.errorCode,
  };
  vercelTrack("roadmap_generation_failed", payload);
  mirrorToServer("roadmap_generation_failed", payload);
}

export const ONBOARDING_STEP_NAMES: Record<number, string> = {
  1: "target_role",
  2: "claim_username",
  3: "current_role",
  4: "years_of_experience",
  5: "ai_fluency",
  6: "identity_confirm",
  7: "referral_source",
};
