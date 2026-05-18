import type { ResumeAngle, SectionName, TargetRole } from "@/lib/resume/types";

export const TARGET_ROLE_OPTIONS: { value: TargetRole; label: string }[] = [
  { value: "AI_PM", label: "AI Product Manager" },
  { value: "AI_GENERALIST", label: "AI Generalist" },
  { value: "AI_ENGINEER", label: "AI Engineer" },
  { value: "AI_MARKETER", label: "AI Marketer" },
  { value: "AI_OPERATOR", label: "AI Operator" },
  { value: "AI_FOUNDER", label: "AI-Native Founder" },
];

export const VARIANT_TABS: { angle: ResumeAngle; label: string }[] = [
  { angle: "ENGINEER_TO_PM", label: "Engineer → PM" },
  { angle: "DOMAIN_EXPERT_AI", label: "Domain Expert + AI" },
  { angle: "GENERALIST_BUILDER", label: "Generalist Builder" },
];

export const GENERATION_STATUS_MESSAGES = [
  "Parsing your resume…",
  "Identifying positioning angles…",
  "Generating 3 variants…",
  "Scoring ATS compatibility…",
] as const;

export const SECTION_LABELS: Record<SectionName, string> = {
  SUMMARY: "Summary",
  EXPERIENCE: "Experience",
  SKILLS: "Skills",
  PROJECTS: "Projects",
  EDUCATION: "Education",
  CERTIFICATIONS: "Certifications",
};

export const ATS_BREAKDOWN_ROWS: {
  key: keyof import("@/lib/resume/types").ATSBreakdown;
  label: string;
  max: number;
}[] = [
  { key: "keywordMatch", label: "Keyword match", max: 25 },
  { key: "formattingScore", label: "Formatting", max: 20 },
  { key: "actionVerbDensity", label: "Action verbs", max: 20 },
  { key: "quantifiedImpactRatio", label: "Quantified impact", max: 20 },
  { key: "aiDepthSignal", label: "AI depth", max: 15 },
];
