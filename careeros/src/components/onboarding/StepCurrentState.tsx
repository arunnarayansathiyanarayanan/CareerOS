"use client";

import { Check } from "lucide-react";

import { CurrentRoleAutocompleteField } from "@/components/onboarding/CurrentRoleAutocompleteField";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/store/onboardingStore";

const YEARS = [
  { value: "0-1", label: "0–1 yr" },
  { value: "1-3", label: "1–3 yrs" },
  { value: "3-7", label: "3–7 yrs" },
  { value: "7-12", label: "7–12 yrs" },
  { value: "12+", label: "12+ yrs" },
] as const;

const AI_FLUENCY = [
  {
    value: "not_started",
    title: "Haven't started yet",
    description: "I know I need to, haven't",
  },
  {
    value: "played_with_chatgpt",
    title: "Played with ChatGPT",
    description: "Use it occasionally, not systematically",
  },
  {
    value: "built_workflows",
    title: "Built AI workflows",
    description: "Automated tasks, built prompts, used APIs",
  },
  {
    value: "shipped_projects",
    title: "Shipped AI projects",
    description: "Deployed things others use",
  },
  {
    value: "working_in_ai",
    title: "Working in AI",
    description: "AI is my primary tool or domain",
  },
] as const;

function OperatorFieldLabel({ step, title }: { step: string; title: string }) {
  return (
    <p className="text-[0.68rem] font-medium tracking-[0.22em] text-zinc-500 uppercase">
      <span className="text-zinc-400">{step}</span>
      <span className="mx-1.5 font-normal text-zinc-600">/</span>
      <span className="text-zinc-300">{title}</span>
    </p>
  );
}

export function StepCurrentState({ onContinue }: { onContinue: () => void }) {
  const currentRole = useOnboardingStore((s) => s.currentRole);
  const yearsOfExperience = useOnboardingStore((s) => s.yearsOfExperience);
  const aiFluency = useOnboardingStore((s) => s.aiFluency);
  const setField = useOnboardingStore((s) => s.setField);

  const query = (currentRole ?? "").trim();

  const canContinue =
    query.length > 0 &&
    Boolean(yearsOfExperience) &&
    Boolean(aiFluency);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <OperatorFieldLabel step="01" title="Current role" />
        <CurrentRoleAutocompleteField />
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

      <section className="flex flex-col gap-5">
        <OperatorFieldLabel step="02" title="Experience" />
        <div
          className="flex flex-wrap gap-2.5"
          role="radiogroup"
          aria-label="Years of experience"
        >
          {YEARS.map(({ value, label }) => {
            const selected = yearsOfExperience === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setField("yearsOfExperience", value)}
                className={cn(
                  "rounded-full border px-4 py-2.5 text-sm font-medium tracking-tight transition-[border-color,background-color,color,box-shadow] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
                  selected
                    ? "border-[#E5FF47] bg-[#E5FF47] text-[#111] shadow-none focus-visible:ring-[#E5FF47]"
                    : "border-zinc-700 bg-zinc-900/40 text-zinc-200 hover:border-zinc-500 focus-visible:ring-zinc-500"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

      <section className="flex flex-col gap-5">
        <OperatorFieldLabel step="03" title="AI fluency" />
        <div
          className="flex flex-col gap-3.5"
          role="radiogroup"
          aria-label="AI fluency"
        >
          {AI_FLUENCY.map(({ value, title, description }) => {
            const selected = aiFluency === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setField("aiFluency", value)}
                className={cn(
                  "group relative flex w-full flex-col gap-1 rounded-xl border border-solid px-4 py-4 text-left transition-[border-color,box-shadow,background-color] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
                  selected
                    ? "border-[#E5FF47] bg-[#161616] shadow-[0_0_22px_rgba(229,255,71,0.12)] focus-visible:ring-[#E5FF47]"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600 focus-visible:ring-zinc-500"
                )}
              >
                {selected ? (
                  <span
                    className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-[#E5FF47]/20 text-[#E5FF47]"
                    aria-hidden
                  >
                    <Check className="size-3.5 stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round" />
                  </span>
                ) : null}
                <span
                  className={cn(
                    "pr-8 font-sans text-[0.9375rem] font-semibold tracking-tight",
                    selected ? "text-[#E5FF47]" : "text-zinc-100"
                  )}
                >
                  {title}
                </span>
                <span
                  className={cn(
                    "text-sm leading-snug",
                    selected ? "text-zinc-400" : "text-zinc-500 group-hover:text-zinc-400"
                  )}
                >
                  {description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {canContinue ? (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className="h-9 w-full bg-[#E5FF47] text-sm font-medium text-[#111] transition-[opacity,transform,box-shadow] duration-200 ease-out hover:bg-[#d8f542] sm:min-w-[120px] sm:w-auto"
            onClick={() => void onContinue()}
          >
            Continue
          </Button>
        </div>
      ) : null}
    </div>
  );
}
