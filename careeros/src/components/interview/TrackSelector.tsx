"use client";

import {
  TURNS_BY_SUB_MODE,
  type SubMode,
  type Track,
} from "@/lib/ai/question-bank";
import { cn } from "@/lib/utils";

const MINUTES_PER_TURN = 2.5;

type SubModeOption = {
  id: SubMode;
  label: string;
  description: string;
  available: boolean;
};

type TrackOption = {
  id: Track;
  label: string;
  tagline: string;
  subModes: SubModeOption[];
};

const TRACK_OPTIONS: TrackOption[] = [
  {
    id: "ai_pm",
    label: "AI PM",
    tagline: "Product leadership, strategy, and AI-native product decisions",
    subModes: [
      {
        id: "product_sense",
        label: "Product Sense",
        description:
          "Design AI-native features with user and metric clarity",
        available: true,
      },
      {
        id: "ai_system_design",
        label: "AI System Design",
        description:
          "Architect ML pipelines, serving, feedback loops, and fallbacks",
        available: true,
      },
      {
        id: "ai_prioritization",
        label: "AI Prioritization",
        description:
          "Prioritize AI roadmap bets with frameworks, data, and risk tradeoffs",
        available: true,
      },
      {
        id: "ai_strategy_case",
        label: "AI Strategy Case",
        description:
          "Shape build-vs-buy, moat, and go-to-market for AI initiatives",
        available: true,
      },
      {
        id: "behavioral",
        label: "Behavioral",
        description:
          "Tell STAR stories about shipping, failing, and learning with AI",
        available: true,
      },
    ],
  },
  {
    id: "ai_generalist",
    label: "AI Generalist",
    tagline: "Workflow design, tooling, automation, and cross-functional AI",
    subModes: [
      {
        id: "ai_workflow_design",
        label: "AI Workflow Design",
        description:
          "Design end-to-end AI workflows with human-in-the-loop guardrails",
        available: true,
      },
      {
        id: "tool_selection",
        label: "Tool Selection",
        description:
          "Choose stacks for RAG, agents, and production AI with cost in mind",
        available: true,
      },
      {
        id: "automation_case",
        label: "Automation Case",
        description:
          "Scope reliable automations, edge cases, and stakeholder delivery",
        available: true,
      },
      {
        id: "ai_ops_behavioral",
        label: "AI Ops Behavioral",
        description:
          "Reflect on production failures, debugging, and workflow redesign",
        available: true,
      },
      {
        id: "cross_functional_ai",
        label: "Cross-Functional AI",
        description:
          "Communicate AI limits and drive buy-in across technical and business teams",
        available: true,
      },
    ],
  },
];

function estimateDuration(subMode: SubMode): string {
  const minutes = Math.round(TURNS_BY_SUB_MODE[subMode] * MINUTES_PER_TURN);
  return `~${minutes} min`;
}

export type TrackSelectorProps = {
  selectedTrack: Track | null;
  selectedSubMode: SubMode | null;
  onTrackChange: (track: Track) => void;
  onSubModeChange: (subMode: SubMode) => void;
};

export function TrackSelector({
  selectedTrack,
  selectedSubMode,
  onTrackChange,
  onSubModeChange,
}: TrackSelectorProps) {
  const activeTrack =
    TRACK_OPTIONS.find((track) => track.id === selectedTrack) ?? null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-zinc-300">Interview track</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Choose a track, then pick a focus area for this session.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TRACK_OPTIONS.map((track) => {
          const isSelected = selectedTrack === track.id;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => onTrackChange(track.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                isSelected
                  ? "border-[#E5FF47]/60 bg-[#E5FF47]/5 ring-1 ring-[#E5FF47]/30"
                  : "border-zinc-800 bg-[#1A1A1A] hover:border-zinc-700"
              )}
            >
              <p className="text-sm font-semibold text-zinc-100">{track.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {track.tagline}
              </p>
            </button>
          );
        })}
      </div>

      {activeTrack ? (
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-[#141414] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {activeTrack.label} — focus area
          </p>
          <ul className="space-y-2">
            {activeTrack.subModes.map((subMode) => {
              const isSelected = selectedSubMode === subMode.id;
              const disabled = !subMode.available;
              return (
                <li key={subMode.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSubModeChange(subMode.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                      disabled && "cursor-not-allowed opacity-50",
                      isSelected
                        ? "border-[#E5FF47]/50 bg-[#E5FF47]/5"
                        : "border-zinc-800/80 bg-[#1A1A1A] hover:border-zinc-700",
                      !disabled && !isSelected && "hover:bg-[#1E1E1E]"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100">
                        {subMode.label}
                      </p>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {estimateDuration(subMode.id)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      {subMode.description}
                    </p>
                    {disabled ? (
                      <p className="mt-2 text-xs text-zinc-600">Coming soon</p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
