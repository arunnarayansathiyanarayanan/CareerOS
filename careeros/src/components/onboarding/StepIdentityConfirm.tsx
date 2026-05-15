"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { trackRoadmapGenerationFailed } from "@/lib/analytics";
import { useOnboardingStore } from "@/store/onboardingStore";

const TARGET_ROLE_LABELS: Record<string, string> = {
  ai_product_manager: "AI Product Manager",
  ai_generalist: "AI Generalist",
  ai_engineer: "AI Engineer",
  ai_marketer: "AI Marketer",
  ai_operator: "AI Operator",
  ai_native_founder: "AI-Native Founder",
  other: "AI professional",
};

const EXPERIENCE_LINE: Record<string, string> = {
  "0-1": "You're in the first year of your career.",
  "1-3": "You're 1–3 years into your career.",
  "3-7": "You're 3–7 years into your career.",
  "7-12": "You're 7–12 years into your career.",
  "12+": "You're over a decade into your career.",
};

const AI_FLUENCY_LINE: Record<string, string> = {
  not_started: "You're at the start of your AI journey.",
  played_with_chatgpt: "You've explored tools like ChatGPT.",
  built_workflows: "You've built real workflows with AI.",
  shipped_projects: "You've shipped AI projects others use.",
  working_in_ai: "You already work in AI day to day.",
};

export type ResumeCompletePayload = {
  resumeUrl: string;
  resumeParsed: Record<string, unknown>;
  skillCount: number;
};

export function StepIdentityConfirm({
  onBack,
  onSuccess,
  resumeForComplete = null,
  roadmapAlreadyCreated = false,
}: {
  onBack: () => void;
  onSuccess: (
    metrics?: { roadmapGeneratedMs: number }
  ) => void | Promise<void>;
  /** When set, included in `/api/onboarding/complete` and used for the skills line when skillCount is positive. */
  resumeForComplete?: ResumeCompletePayload | null;
  /** After `/complete` has succeeded once, Back from the next step remounts this screen — skip a duplicate POST. */
  roadmapAlreadyCreated?: boolean;
}) {
  const targetRole = useOnboardingStore((s) => s.targetRole);
  const yearsOfExperience = useOnboardingStore((s) => s.yearsOfExperience);
  const aiFluency = useOnboardingStore((s) => s.aiFluency);
  const currentRole = useOnboardingStore((s) => s.currentRole);
  const referralSource = useOnboardingStore((s) => s.referralSource);
  const resumeUploaded = useOnboardingStore((s) => s.resumeUploaded);
  const mergeSessionAttributionIntoUtmParams = useOnboardingStore(
    (s) => s.mergeSessionAttributionIntoUtmParams
  );

  const [phase, setPhase] = useState<"review" | "building">("review");

  const roleLabel = targetRole ? TARGET_ROLE_LABELS[targetRole] ?? targetRole : "";
  const experienceLine =
    yearsOfExperience && EXPERIENCE_LINE[yearsOfExperience]
      ? EXPERIENCE_LINE[yearsOfExperience]
      : "";
  const aiLine =
    aiFluency && AI_FLUENCY_LINE[aiFluency] ? AI_FLUENCY_LINE[aiFluency] : "";

  const skillsLine = useMemo(() => {
    const n = resumeForComplete?.skillCount;
    if (typeof n === "number" && n > 0) {
      return `Your ${n} existing skills will accelerate your path.`;
    }
    if (resumeUploaded) {
      return "Your existing skills will accelerate your path.";
    }
    return null;
  }, [resumeForComplete?.skillCount, resumeUploaded]);

  const runComplete = useCallback(async () => {
    if (roadmapAlreadyCreated) {
      await Promise.resolve(onSuccess({ roadmapGeneratedMs: 0 }));
      return;
    }
    if (!targetRole || !yearsOfExperience || !aiFluency) {
      toast.error("Please complete all required fields.");
      return;
    }
    mergeSessionAttributionIntoUtmParams();
    const state = useOnboardingStore.getState();
    setPhase("building");
    const roadmapStartedAt = Date.now();
    try {
      const body: Record<string, unknown> = {
        targetRole,
        yearsOfExperience,
        aiFluency,
        currentRole: currentRole ?? undefined,
        referralSource: referralSource ?? undefined,
        utmParams:
          Object.keys(state.utmParams).length > 0 ? state.utmParams : undefined,
      };
      if (resumeForComplete?.resumeUrl && resumeForComplete.resumeParsed) {
        body.resumeUrl = resumeForComplete.resumeUrl;
        body.resumeParsed = resumeForComplete.resumeParsed;
      }

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code =
          typeof errBody === "object" &&
          errBody &&
          "code" in errBody &&
          typeof (errBody as { code?: unknown }).code === "string"
            ? (errBody as { code: string }).code
            : "REQUEST_FAILED";
        if (code === "ROADMAP_GENERATION_FAILED") {
          trackRoadmapGenerationFailed({
            fallbackUsed: false,
            errorCode: code,
          });
        }
        throw new Error(
          typeof errBody === "object" && errBody && "error" in errBody
            ? String((errBody as { error?: string }).error)
            : "Submit failed"
        );
      }
      const roadmapGeneratedMs = Date.now() - roadmapStartedAt;
      await Promise.resolve(onSuccess({ roadmapGeneratedMs }));
    } catch (e) {
      setPhase("review");
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  }, [
    targetRole,
    yearsOfExperience,
    aiFluency,
    currentRole,
    referralSource,
    resumeForComplete,
    mergeSessionAttributionIntoUtmParams,
    onSuccess,
    roadmapAlreadyCreated,
  ]);

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-10 text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={phase === "building" ? "building" : "review"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-8"
        >
            <p className="text-balance text-3xl font-bold leading-[1.25] tracking-tight text-zinc-50 sm:text-4xl">
              You are becoming an{" "}
              <span className="text-[#E5FF47]">{roleLabel}</span>.<br />
              {experienceLine ? (
                <>
                  {experienceLine}
                  <br />
                </>
              ) : null}
              {aiLine ? (
                <>
                  {aiLine}
                  <br />
                </>
              ) : null}
              {skillsLine ? (
                <>
                  {skillsLine}
                  <br />
                </>
              ) : null}
              Your personalized roadmap is being built.
            </p>

            {phase === "building" ? (
              <div
                className="flex flex-col items-center gap-4 text-zinc-300"
                aria-live="polite"
                aria-busy
              >
                <div className="flex items-center gap-3 text-base font-medium text-zinc-200">
                  <span
                    className="size-5 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-[#E5FF47]"
                    aria-hidden
                  />
                  <span>Building your roadmap…</span>
                  <span className="inline-flex w-6 justify-start gap-0.5" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="inline-block size-1 rounded-full bg-[#E5FF47]"
                        animate={{ opacity: [0.25, 1, 0.25] }}
                        transition={{
                          duration: 1.1,
                          repeat: Infinity,
                          delay: i * 0.18,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            ) : null}
        </motion.div>
      </AnimatePresence>

      {phase === "review" ? (
        <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-between sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            type="button"
            className="bg-[#E5FF47] text-sm font-semibold text-[#111] hover:bg-[#d8f542] sm:min-w-[200px]"
            onClick={() => void runComplete()}
          >
            {roadmapAlreadyCreated
              ? "Continue"
              : "Looks right — show me my roadmap"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
