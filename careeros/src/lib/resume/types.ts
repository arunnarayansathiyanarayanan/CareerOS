import { z } from "zod";

export const ParsedResumeSchema = z.object({
  contact: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    linkedin: z.string().nullable(),
    github: z.string().nullable(),
    portfolio: z.string().nullable(),
  }),
  summary: z.string().nullable(),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      duration: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  skills: z.array(z.string()),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      stack: z.array(z.string()),
      outcome: z.string().nullable(),
    })
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      year: z.string().nullable(),
    })
  ),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string().nullable(),
      year: z.string().nullable(),
    })
  ),
});

export const ATSBreakdownSchema = z.object({
  keywordMatch: z.number(),
  formattingScore: z.number(),
  actionVerbDensity: z.number(),
  quantifiedImpactRatio: z.number(),
  aiDepthSignal: z.number(),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
export type ATSBreakdown = z.infer<typeof ATSBreakdownSchema>;

export type TargetRole =
  | "AI_PM"
  | "AI_GENERALIST"
  | "AI_ENGINEER"
  | "AI_MARKETER"
  | "AI_OPERATOR"
  | "AI_FOUNDER";

export type ResumeAngle =
  | "ENGINEER_TO_PM"
  | "DOMAIN_EXPERT_AI"
  | "GENERALIST_BUILDER";

export type SectionName =
  | "SUMMARY"
  | "EXPERIENCE"
  | "SKILLS"
  | "PROJECTS"
  | "EDUCATION"
  | "CERTIFICATIONS";

export interface GeneratedVariantContent extends ParsedResume {
  careerOsLink: string;
  featuredProjects: string[];
}

export class ResumeUploadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResumeUploadError";
  }
}

export class ResumeParseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResumeParseError";
  }
}
