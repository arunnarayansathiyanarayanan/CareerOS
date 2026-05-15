"use client";

import type { LucideIcon } from "lucide-react";
import {
  Check,
  Cpu,
  Megaphone,
  Rocket,
  Sparkles,
  SquareKanban,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/store/onboardingStore";

const ROLES: readonly {
  value: string;
  label: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    value: "ai_product_manager",
    label: "AI Product Manager",
    description: "Ship AI features that users love and boards approve",
    Icon: SquareKanban,
  },
  {
    value: "ai_generalist",
    label: "AI Generalist",
    description: "Automate workflows and build AI tools across any domain",
    Icon: Sparkles,
  },
  {
    value: "ai_engineer",
    label: "AI Engineer",
    description: "Build the models, pipelines, and infra that power AI products",
    Icon: Cpu,
  },
  {
    value: "ai_marketer",
    label: "AI Marketer",
    description: "Run campaigns, content, and growth with AI-native leverage",
    Icon: Megaphone,
  },
  {
    value: "ai_operator",
    label: "AI Operator",
    description: "Run operations, finance, or CS functions with AI efficiency",
    Icon: Workflow,
  },
  {
    value: "ai_native_founder",
    label: "AI-Native Founder",
    description: "Build a company where AI is the product and the moat",
    Icon: Rocket,
  },
];

export function StepTargetRole({ onContinue }: { onContinue: () => void }) {
  const targetRole = useOnboardingStore((s) => s.targetRole);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <div className="flex flex-col gap-6">
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Target role"
      >
        {ROLES.map(({ value, label, description, Icon }) => {
          const selected = targetRole === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setField("targetRole", value)}
              className={cn(
                "group relative flex gap-3 rounded-xl border border-solid p-4 text-left transition-[border-color,box-shadow,background-color,color] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
                selected
                  ? "border-[#E5FF47] bg-[#E5FF47] text-[#111] shadow-none focus-visible:ring-[#E5FF47]"
                  : "border-[#222] bg-[#111] hover:border-[#E5FF47] hover:shadow-[0_0_22px_rgba(229,255,71,0.28)] focus-visible:ring-zinc-500"
              )}
            >
              {selected ? (
                <span
                  className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/10 text-[#111]"
                  aria-hidden
                >
                  <Check className="size-3.5 stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round" />
                </span>
              ) : null}

              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-lg border transition-[border-color,background-color,color] duration-200 ease-out",
                  selected
                    ? "border-black/15 bg-black/[0.06] text-[#111]"
                    : "border-[#222] bg-[#161616] text-zinc-300 group-hover:border-[#E5FF47] group-hover:text-[#E5FF47]"
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>

              <span className="min-w-0 flex-1 pr-7">
                <span
                  className={cn(
                    "font-sans text-[0.9375rem] font-semibold tracking-tight",
                    selected ? "text-[#111]" : "text-zinc-100"
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-sm leading-snug transition-colors duration-200 ease-out",
                    selected ? "text-[#292929]" : "text-zinc-500 group-hover:text-zinc-400"
                  )}
                >
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {targetRole ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <span aria-hidden className="hidden sm:block" />
          <Button
            type="button"
            className="h-9 w-full bg-[#E5FF47] text-sm font-medium text-[#111] transition-[opacity,transform,box-shadow] duration-200 ease-out hover:bg-[#d8f542] hover:opacity-100 sm:ml-auto sm:min-w-[120px] sm:w-auto"
            onClick={() => void onContinue()}
          >
            Continue
          </Button>
        </div>
      ) : null}
    </div>
  );
}
