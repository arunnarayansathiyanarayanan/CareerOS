"use client";

import { useOnboardingStore } from "@/store/onboardingStore";

const TOTAL_STEPS = 5;
const ACCENT = "oklch(0.55 0.22 264)";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const step = useOnboardingStore((s) => s.step);
  const progress = Math.min(100, Math.max(0, (step / TOTAL_STEPS) * 100));

  return (
    <div
      className="dark fixed inset-0 z-50 flex min-h-0 flex-col bg-[#0A0A0A] text-zinc-100"
      style={{ ["--onboarding-accent" as string]: ACCENT }}
    >
      <div
        className="h-[2px] w-full shrink-0 bg-zinc-800"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label="Onboarding progress"
      >
        <div
          className="h-[2px] bg-[var(--onboarding-accent)] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 sm:px-10">
        <span className="text-sm font-semibold tracking-tight text-zinc-300">
          CareerOS
        </span>
        <span className="text-sm tabular-nums text-zinc-500">
          {step} of {TOTAL_STEPS}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10">
        {children}
      </div>
    </div>
  );
}
