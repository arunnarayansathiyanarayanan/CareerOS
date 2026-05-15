"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  StepIdentityConfirm,
  type ResumeCompletePayload,
} from "@/components/onboarding/StepIdentityConfirm";
import { StepResumeUpload } from "@/components/onboarding/StepResumeUpload";
import { StepTargetRole } from "@/components/onboarding/StepTargetRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  flattenAttributionSnapshot,
  readAttributionFromSession,
} from "@/lib/careerosAttribution";
import {
  ONBOARDING_STEP_NAMES,
  trackOnboardingCompleted,
  trackOnboardingRoleSelected,
  trackOnboardingStarted,
  trackOnboardingStepCompleted,
} from "@/lib/analytics";
import { useOnboardingStore } from "@/store/onboardingStore";

const TOTAL_STEPS = 6;

const YEARS_OPTIONS = [
  { value: "0-1", label: "0–1 years" },
  { value: "1-3", label: "1–3 years" },
  { value: "3-7", label: "3–7 years" },
  { value: "7-12", label: "7–12 years" },
  { value: "12+", label: "12+ years" },
] as const;

const AI_FLUENCY_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "played_with_chatgpt", label: "Played with ChatGPT" },
  { value: "built_workflows", label: "Built workflows" },
  { value: "shipped_projects", label: "Shipped projects" },
  { value: "working_in_ai", label: "Working in AI" },
] as const;

type ServerProfile = {
  step: number;
  targetRole: string | null;
  currentRole: string | null;
  yearsOfExperience: string | null;
  aiFluency: string | null;
  referralSource: string | null;
  utmParams: Record<string, string>;
  resumeUrl: string | null;
  onboardingCompletedAt: string | null;
};

function buildProgressPatchBody(state: ReturnType<typeof useOnboardingStore.getState>) {
  const data: Record<string, unknown> = {};
  if (state.targetRole) data.targetRole = state.targetRole;
  if (state.currentRole !== null) data.currentRole = state.currentRole;
  if (state.yearsOfExperience) data.yearsOfExperience = state.yearsOfExperience;
  if (state.aiFluency) data.aiFluency = state.aiFluency;
  if (state.referralSource !== null) data.referralSource = state.referralSource;
  if (Object.keys(state.utmParams).length > 0) data.utmParams = state.utmParams;
  return data;
}

async function patchProgress(step: number) {
  const state = useOnboardingStore.getState();
  const res = await fetch("/api/onboarding/progress", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step,
      data: buildProgressPatchBody(state),
    }),
  });
  if (!res.ok && res.status !== 401) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err === "object" && err && "error" in err
        ? String((err as { error?: string }).error)
        : "Could not save progress"
    );
  }
}

const slideTransition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

export default function OnboardingPage() {
  const router = useRouter();
  const step = useOnboardingStore((s) => s.step);
  const currentRole = useOnboardingStore((s) => s.currentRole);
  const yearsOfExperience = useOnboardingStore((s) => s.yearsOfExperience);
  const aiFluency = useOnboardingStore((s) => s.aiFluency);
  const referralSource = useOnboardingStore((s) => s.referralSource);
  const startedAt = useOnboardingStore((s) => s.startedAt);

  const setStep = useOnboardingStore((s) => s.setStep);
  const setField = useOnboardingStore((s) => s.setField);
  const applyServerProgress = useOnboardingStore((s) => s.applyServerProgress);
  const ensureStepOneStarted = useOnboardingStore((s) => s.ensureStepOneStarted);
  const clearSessionAttribution = useOnboardingStore(
    (s) => s.clearSessionAttribution
  );
  const reset = useOnboardingStore((s) => s.reset);

  const [hydrated, setHydrated] = useState(false);
  const [resumeReady, setResumeReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roadmapCreated, setRoadmapCreated] = useState(false);
  const [resumeForComplete, setResumeForComplete] =
    useState<ResumeCompletePayload | null>(null);
  const resumeFetchStarted = useRef(false);
  const onboardingStartedTracked = useRef(false);
  const stepEnteredAtRef = useRef(Date.now());
  const urlStepApplied = useRef(false);

  useEffect(() => {
    if (useOnboardingStore.persist.hasHydrated()) setHydrated(true);
    return useOnboardingStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    ensureStepOneStarted();
  }, [hydrated, step, ensureStepOneStarted]);

  useEffect(() => {
    if (!hydrated || urlStepApplied.current || typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("step");
    if (raw === null) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > TOTAL_STEPS) return;
    setStep(n);
    urlStepApplied.current = true;
  }, [hydrated, setStep]);

  useEffect(() => {
    if (!hydrated || resumeFetchStarted.current) return;
    resumeFetchStarted.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/onboarding/progress");
        if (res.status === 401) {
          setResumeReady(true);
          return;
        }
        if (!res.ok) {
          setResumeReady(true);
          return;
        }
        const json: { profile: ServerProfile | null } = await res.json();
        const profile = json.profile;
        if (
          profile &&
          profile.onboardingCompletedAt === null &&
          typeof profile.step === "number"
        ) {
          applyServerProgress(profile);
        }
      } catch {
        // keep local state
      } finally {
        setResumeReady(true);
      }
    })();
  }, [hydrated, applyServerProgress]);

  useEffect(() => {
    stepEnteredAtRef.current = Date.now();
  }, [step]);

  useEffect(() => {
    if (!hydrated || !resumeReady || onboardingStartedTracked.current) return;
    onboardingStartedTracked.current = true;
    const s = useOnboardingStore.getState();
    const sessionFlat = (() => {
      const snap = readAttributionFromSession();
      return snap ? flattenAttributionSnapshot(snap) : {};
    })();
    trackOnboardingStarted({
      referralSource: s.referralSource,
      utmSource: s.utmParams.utm_source ?? sessionFlat.utm_source ?? null,
      utmMedium: s.utmParams.utm_medium ?? sessionFlat.utm_medium ?? null,
    });
  }, [hydrated, resumeReady]);

  const advance = useCallback(async () => {
    const prev = step;
    const timeOnStep = Math.max(0, Date.now() - stepEnteredAtRef.current);
    const next = Math.min(step + 1, TOTAL_STEPS);
    try {
      await patchProgress(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      return;
    }
    const stepName = ONBOARDING_STEP_NAMES[prev] ?? `step_${prev}`;
    trackOnboardingStepCompleted({
      step: prev,
      stepName,
      timeOnStep,
    });
    if (prev === 1) {
      const tr = useOnboardingStore.getState().targetRole;
      if (tr) trackOnboardingRoleSelected({ targetRole: tr });
    }
    setStep(next);
  }, [step, setStep]);

  const goBack = useCallback(() => {
    if (step <= 1) return;
    setStep(step - 1);
  }, [step, setStep]);

  const handleIdentitySuccess = useCallback(
    async (metrics?: { roadmapGeneratedMs: number }) => {
      if (!roadmapCreated) {
        const end = Date.now();
        const start = startedAt ?? end;
        const totalTimeSeconds = Math.max(0, Math.round((end - start) / 1000));
        const s = useOnboardingStore.getState();
        trackOnboardingCompleted({
          targetRole: s.targetRole ?? "",
          yearsOfExperience: s.yearsOfExperience ?? "",
          aiFluency: s.aiFluency ?? "",
          resumeUploaded: s.resumeUploaded,
          totalTimeSeconds,
          roadmapGeneratedMs: metrics?.roadmapGeneratedMs ?? 0,
        });
        clearSessionAttribution();
        try {
          await patchProgress(6);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not save progress");
        }
        setRoadmapCreated(true);
      }
      setStep(6);
    },
    [roadmapCreated, startedAt, clearSessionAttribution, setStep]
  );

  const handleFinalSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {};
      if (referralSource !== null && referralSource.trim() !== "") {
        data.referralSource = referralSource.trim();
      }
      const res = await fetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 6, data }),
      });
      if (!res.ok && res.status !== 401) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body === "object" && body && "error" in body
            ? String((body as { error?: string }).error)
            : "Save failed"
        );
      }
      reset();
      setResumeForComplete(null);
      toast.success("Welcome to CareerOS");
      router.push("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }, [referralSource, reset, router, setResumeForComplete]);

  if (!hydrated || !resumeReady) {
    return (
      <div className="flex flex-col items-center gap-3 text-center text-sm text-zinc-500">
        <div className="size-6 animate-pulse rounded-full bg-zinc-700" />
        Loading…
      </div>
    );
  }

  const canAdvanceStep2 = Boolean((currentRole ?? "").trim());
  const canAdvanceStep3 = Boolean(yearsOfExperience);

  return (
    <div className="flex w-full max-w-lg flex-col items-stretch">
      <AnimatePresence mode="wait" initial={false}>
        {step === 1 && (
          <motion.div
            key="step-1"
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={slideTransition}
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                What role are you targeting?
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                We use this to tailor your roadmap.
              </p>
            </div>
            <StepTargetRole onContinue={advance} />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={slideTransition}
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Current role
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                A short title is enough (e.g. &ldquo;Senior PM&rdquo;).
              </p>
            </div>
            <Input
              value={currentRole ?? ""}
              onChange={(e) => setField("currentRole", e.target.value)}
              placeholder="Your current role"
              maxLength={100}
              className="border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600"
            />
            <StepNav
              canNext={canAdvanceStep2}
              onNext={advance}
              onBack={goBack}
            />
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step-3"
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={slideTransition}
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Years of experience
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Rough range is fine.
              </p>
            </div>
            <Select
              value={yearsOfExperience ?? undefined}
              onValueChange={(v) => setField("yearsOfExperience", v)}
            >
              <SelectTrigger className="w-full border-zinc-700 bg-zinc-900/80 text-zinc-100">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {YEARS_OPTIONS.map((y) => (
                  <SelectItem key={y.value} value={y.value}>
                    {y.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <StepNav
              canNext={canAdvanceStep3}
              onNext={advance}
              onBack={goBack}
            />
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step-4"
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={slideTransition}
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                AI fluency
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Optional: upload your resume on this step so we can tailor your roadmap.
              </p>
            </div>
            <Select
              value={aiFluency ?? undefined}
              onValueChange={(v) => setField("aiFluency", v)}
            >
              <SelectTrigger className="w-full border-zinc-700 bg-zinc-900/80 text-zinc-100">
                <SelectValue placeholder="Where are you today?" />
              </SelectTrigger>
              <SelectContent>
                {AI_FLUENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <StepResumeUpload
              continueExtraDisabled={!aiFluency}
              onBack={goBack}
              onContinue={advance}
              onResumeDataChange={(data) => {
                if (
                  data.resumeUrl &&
                  data.resumeParsed &&
                  data.skillCount !== null
                ) {
                  setResumeForComplete({
                    resumeUrl: data.resumeUrl,
                    resumeParsed: data.resumeParsed,
                    skillCount: data.skillCount,
                  });
                } else {
                  setResumeForComplete(null);
                }
              }}
            />
          </motion.div>
        )}

        {step === 5 && (
          <motion.div
            key="step-5"
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={slideTransition}
          >
            <StepIdentityConfirm
              onBack={goBack}
              onSuccess={handleIdentitySuccess}
              resumeForComplete={resumeForComplete}
              roadmapAlreadyCreated={roadmapCreated}
            />
          </motion.div>
        )}

        {step === 6 && (
          <motion.div
            key="step-6"
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={slideTransition}
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Almost there
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                How did you hear about CareerOS? (optional)
              </p>
            </div>
            <Input
              value={referralSource ?? ""}
              onChange={(e) => setField("referralSource", e.target.value)}
              placeholder="e.g. friend, Twitter, search"
              className="border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={goBack}
              >
                Back
              </Button>
              <Button
                type="button"
                className="bg-[var(--onboarding-accent)] text-white hover:opacity-90"
                style={{ ["--onboarding-accent" as string]: "oklch(0.55 0.22 264)" }}
                disabled={submitting}
                onClick={() => void handleFinalSubmit()}
              >
                {submitting ? "Submitting…" : "Finish"}
              </Button>
            </div>
            <p className="text-center text-xs text-zinc-600">
              <Link href="/" className="underline underline-offset-2 hover:text-zinc-400">
                Exit to home
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepNav({
  canNext,
  onNext,
  onBack,
  showBack = true,
}: {
  canNext: boolean;
  onNext: () => void;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
      {showBack ? (
        <Button
          type="button"
          variant="ghost"
          className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          onClick={onBack}
        >
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button
        type="button"
        className="bg-[var(--onboarding-accent)] text-white hover:opacity-90 sm:min-w-[120px]"
        style={{ ["--onboarding-accent" as string]: "oklch(0.55 0.22 264)" }}
        disabled={!canNext}
        onClick={() => void onNext()}
      >
        Continue
      </Button>
    </div>
  );
}
