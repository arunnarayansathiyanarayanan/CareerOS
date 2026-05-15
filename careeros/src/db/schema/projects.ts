import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const projectPrivacyModeEnum = pgEnum("project_privacy_mode", [
  "public",
  "unlisted",
  "recruiter_share",
]);

export const projectEmbedTypeEnum = pgEnum("project_embed_type", [
  "github",
  "loom",
  "youtube",
  "notion",
  "deployed_url",
  "screenshot",
  "pdf",
]);

export type ProjectPrivacyMode =
  (typeof projectPrivacyModeEnum.enumValues)[number];

export type ProjectEmbedType =
  (typeof projectEmbedTypeEnum.enumValues)[number];

export type AiReviewerData = {
  strengths: string[];
  improvements: string[];
  portfolio_ready: boolean;
  /** Internal rationale; stripped in public project JSON and recruiter share responses. */
  reasoning?: string;
};

export type TemplateCompletionChecklistItem = {
  label: string;
  required: boolean;
};

export const projectTemplates = pgTable("project_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  description: text("description"),
  problemStatement: text("problem_statement"),
  recommendedStack: text("recommended_stack").array().notNull().default([]),
  successCriteria: text("success_criteria"),
  completionChecklist: jsonb("completion_checklist")
    .$type<TemplateCompletionChecklistItem[]>()
    .notNull()
    .default([]),
  targetRoles: text("target_roles").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    oneLiner: text("one_liner").notNull(),
    problemSolved: text("problem_solved").notNull(),
    aiStack: text("ai_stack").array().notNull().default([]),
    myRole: text("my_role").notNull(),
    outcome: text("outcome").notNull(),
    privacyMode: projectPrivacyModeEnum("privacy_mode").notNull(),
    aiReviewerScore: smallint("ai_reviewer_score"),
    aiReviewerData: jsonb("ai_reviewer_data").$type<AiReviewerData | null>(),
    aiReviewerCallCount: smallint("ai_reviewer_call_count")
      .notNull()
      .default(0),
    autoTags: text("auto_tags").array().notNull().default([]),
    templateId: uuid("template_id").references(() => projectTemplates.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIsDeletedIdx: index("projects_user_id_is_deleted_idx").on(
      table.userId,
      table.isDeleted
    ),
    usernameSlugUniqueActive: uniqueIndex(
      "projects_username_slug_unique_active"
    )
      .on(table.username, table.slug)
      .where(sql`${table.isDeleted} = false`),
    privacyModeIdx: index("projects_privacy_mode_idx")
      .on(table.privacyMode)
      .where(sql`${table.isDeleted} = false`),
  })
);

export const projectEmbeds = pgTable("project_embeds", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: projectEmbedTypeEnum("type").notNull(),
  url: text("url"),
  storageKey: text("storage_key"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  displayOrder: smallint("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const recruiterShareTokens = pgTable(
  "recruiter_share_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true }),
    isRevoked: boolean("is_revoked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenActiveIdx: index("recruiter_share_tokens_token_active_idx")
      .on(table.token)
      .where(sql`${table.isRevoked} = false`),
  })
);

export const projectPublishRateLimit = pgTable(
  "project_publish_rate_limit",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: smallint("count").notNull(),
  }
);

export const projectTemplatesRelations = relations(
  projectTemplates,
  ({ many }) => ({
    projects: many(projects),
  })
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  template: one(projectTemplates, {
    fields: [projects.templateId],
    references: [projectTemplates.id],
  }),
  embeds: many(projectEmbeds),
  recruiterShareTokens: many(recruiterShareTokens),
}));

export const projectEmbedsRelations = relations(projectEmbeds, ({ one }) => ({
  project: one(projects, {
    fields: [projectEmbeds.projectId],
    references: [projects.id],
  }),
}));

export const recruiterShareTokensRelations = relations(
  recruiterShareTokens,
  ({ one }) => ({
    project: one(projects, {
      fields: [recruiterShareTokens.projectId],
      references: [projects.id],
    }),
  })
);

export const projectPublishRateLimitRelations = relations(
  projectPublishRateLimit,
  ({ one }) => ({
    user: one(users, {
      fields: [projectPublishRateLimit.userId],
      references: [users.id],
    }),
  })
);

export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type NewProjectTemplate = typeof projectTemplates.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ProjectEmbed = typeof projectEmbeds.$inferSelect;
export type NewProjectEmbed = typeof projectEmbeds.$inferInsert;

export type RecruiterShareToken = typeof recruiterShareTokens.$inferSelect;
export type NewRecruiterShareToken = typeof recruiterShareTokens.$inferInsert;

export type ProjectPublishRateLimitRow =
  typeof projectPublishRateLimit.$inferSelect;
export type NewProjectPublishRateLimitRow =
  typeof projectPublishRateLimit.$inferInsert;
