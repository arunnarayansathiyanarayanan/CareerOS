import type { SubMode, Track } from "@/lib/ai/question-bank";

export const TRACK_LABELS: Record<Track, string> = {
  ai_pm: "AI PM",
  ai_generalist: "AI Generalist",
};

export const SUB_MODE_LABELS: Record<SubMode, string> = {
  product_sense: "Product Sense",
  ai_system_design: "AI System Design",
  ai_prioritization: "AI Prioritization",
  ai_strategy_case: "AI Strategy Case",
  behavioral: "Behavioral",
  ai_workflow_design: "AI Workflow Design",
  tool_selection: "Tool Selection",
  automation_case: "Automation Case",
  ai_ops_behavioral: "AI Ops Behavioral",
  cross_functional_ai: "Cross-Functional AI",
};

export function getSubModeLabel(subMode: string): string {
  return (
    SUB_MODE_LABELS[subMode as SubMode] ??
    subMode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function getTrackLabel(track: Track | string): string {
  return TRACK_LABELS[track as Track] ?? String(track);
}
