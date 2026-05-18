import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type {
  ATSBreakdown,
  GeneratedVariantContent,
  ParsedResume,
} from "@/lib/resume/types";

export const fileTypeEnum = pgEnum("file_type", ["PDF", "DOCX", "TXT"]);

export const targetRoleEnum = pgEnum("target_role", [
  "AI_PM",
  "AI_GENERALIST",
  "AI_ENGINEER",
  "AI_MARKETER",
  "AI_OPERATOR",
  "AI_FOUNDER",
]);

export const resumeAngleEnum = pgEnum("resume_angle", [
  "ENGINEER_TO_PM",
  "DOMAIN_EXPERT_AI",
  "GENERALIST_BUILDER",
]);

export const sectionNameEnum = pgEnum("section_name", [
  "SUMMARY",
  "EXPERIENCE",
  "SKILLS",
  "PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS",
]);

export type FileType = (typeof fileTypeEnum.enumValues)[number];
export type ResumeTargetRole = (typeof targetRoleEnum.enumValues)[number];
export type ResumeAngle = (typeof resumeAngleEnum.enumValues)[number];
export type ResumeSectionName = (typeof sectionNameEnum.enumValues)[number];

export const resumes = pgTable("resumes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  originalFileName: text("original_file_name").notNull(),
  storageKey: text("storage_key").notNull(),
  fileType: fileTypeEnum("file_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const resumeVersions = pgTable("resume_versions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  resumeId: text("resume_id")
    .notNull()
    .references(() => resumes.id),
  versionNumber: integer("version_number").notNull(),
  parsedData: jsonb("parsed_data").$type<ParsedResume>().notNull(),
  targetRole: targetRoleEnum("target_role").notNull(),
  jobDescription: text("job_description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const resumeVariants = pgTable("resume_variants", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  resumeVersionId: text("resume_version_id")
    .notNull()
    .references(() => resumeVersions.id),
  angle: resumeAngleEnum("angle").notNull(),
  generatedContent: jsonb("generated_content")
    .$type<GeneratedVariantContent>()
    .notNull(),
  atsScore: integer("ats_score").notNull(),
  atsBreakdown: jsonb("ats_breakdown").$type<ATSBreakdown>().notNull(),
  pdfStorageKey: text("pdf_storage_key"),
  docxStorageKey: text("docx_storage_key"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const resumeJobs = pgTable("resume_jobs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  versionId: text("version_id")
    .notNull()
    .references(() => resumeVersions.id),
  status: text("status").notNull().default("processing"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const resumeSectionRewrites = pgTable("resume_section_rewrites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  variantId: text("variant_id")
    .notNull()
    .references(() => resumeVariants.id),
  sectionName: sectionNameEnum("section_name").notNull(),
  originalText: text("original_text").notNull(),
  rewrittenText: text("rewritten_text").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
});

export const resumesRelations = relations(resumes, ({ many }) => ({
  versions: many(resumeVersions),
}));

export const resumeVersionsRelations = relations(
  resumeVersions,
  ({ one, many }) => ({
    resume: one(resumes, {
      fields: [resumeVersions.resumeId],
      references: [resumes.id],
    }),
    variants: many(resumeVariants),
    jobs: many(resumeJobs),
  })
);

export const resumeJobsRelations = relations(resumeJobs, ({ one }) => ({
  version: one(resumeVersions, {
    fields: [resumeJobs.versionId],
    references: [resumeVersions.id],
  }),
}));

export const resumeVariantsRelations = relations(
  resumeVariants,
  ({ one, many }) => ({
    version: one(resumeVersions, {
      fields: [resumeVariants.resumeVersionId],
      references: [resumeVersions.id],
    }),
    sectionRewrites: many(resumeSectionRewrites),
  })
);

export const resumeSectionRewritesRelations = relations(
  resumeSectionRewrites,
  ({ one }) => ({
    variant: one(resumeVariants, {
      fields: [resumeSectionRewrites.variantId],
      references: [resumeVariants.id],
    }),
  })
);

export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;

export type ResumeVersion = typeof resumeVersions.$inferSelect;
export type NewResumeVersion = typeof resumeVersions.$inferInsert;

export type ResumeVariant = typeof resumeVariants.$inferSelect;
export type NewResumeVariant = typeof resumeVariants.$inferInsert;

export type ResumeJob = typeof resumeJobs.$inferSelect;
export type NewResumeJob = typeof resumeJobs.$inferInsert;

export type ResumeSectionRewrite = typeof resumeSectionRewrites.$inferSelect;
export type NewResumeSectionRewrite =
  typeof resumeSectionRewrites.$inferInsert;
