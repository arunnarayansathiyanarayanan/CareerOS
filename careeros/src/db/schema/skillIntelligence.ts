import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { projects } from "./projects";
import { users } from "./users";

export const skillOntologyCategoryEnum = pgEnum("skill_ontology_category", [
  "infra",
  "model",
  "tooling",
  "workflow",
  "domain",
]);

export const jobPostingSourceEnum = pgEnum("job_posting_source", [
  "linkedin",
  "naukri",
  "foundit",
  "wellfound",
]);

export const jobPostingSeniorityEnum = pgEnum("job_posting_seniority", [
  "junior",
  "mid",
  "senior",
]);

export const userSkillGraphSourceEnum = pgEnum("user_skill_graph_source", [
  "declared",
  "project_tag",
  "interview",
]);

export type SkillOntologyCategory =
  (typeof skillOntologyCategoryEnum.enumValues)[number];

export type JobPostingSource =
  (typeof jobPostingSourceEnum.enumValues)[number];

export type JobPostingSeniority =
  (typeof jobPostingSeniorityEnum.enumValues)[number];

export type UserSkillGraphSource =
  (typeof userSkillGraphSourceEnum.enumValues)[number];

export type RankedSkill = {
  skill_id: string;
  priority: number;
  expected_salary_lift_pct: number;
};

export const skillOntology = pgTable(
  "skill_ontology",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull(),
    category: skillOntologyCategoryEnum("category").notNull(),
    aliases: text("aliases").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    categoryIdx: index("skill_ontology_category_idx").on(table.category),
    slugIdx: index("skill_ontology_slug_idx").on(table.slug),
  })
);

export const jobPostingsRaw = pgTable(
  "job_postings_raw",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: jobPostingSourceEnum("source").notNull(),
    externalId: text("external_id").notNull().unique(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    city: text("city").notNull(),
    seniority: jobPostingSeniorityEnum("seniority").notNull(),
    rawSkills: text("raw_skills").array().notNull().default([]),
    salaryMinLpa: numeric("salary_min_lpa", { precision: 8, scale: 2 }),
    salaryMaxLpa: numeric("salary_max_lpa", { precision: 8, scale: 2 }),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceIdx: index("job_postings_raw_source_idx").on(table.source),
    citySeniorityIdx: index("job_postings_raw_city_seniority_idx").on(
      table.city,
      table.seniority
    ),
    postedAtIdx: index("job_postings_raw_posted_at_idx").on(table.postedAt),
  })
);

export const skillDemandSnapshots = pgTable(
  "skill_demand_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skillOntology.id, { onDelete: "cascade" }),
    city: text("city").notNull(),
    role: text("role").notNull(),
    seniority: jobPostingSeniorityEnum("seniority").notNull(),
    periodEnd: date("period_end").notNull(),
    postingCount: integer("posting_count").notNull(),
    salaryP25: numeric("salary_p25", { precision: 8, scale: 2 }),
    salaryP50: numeric("salary_p50", { precision: 8, scale: 2 }),
    salaryP75: numeric("salary_p75", { precision: 8, scale: 2 }),
    salaryP90: numeric("salary_p90", { precision: 8, scale: 2 }),
    sampleSize: integer("sample_size").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    skillIdIdx: index("skill_demand_snapshots_skill_id_idx").on(table.skillId),
    periodEndIdx: index("skill_demand_snapshots_period_end_idx").on(
      table.periodEnd
    ),
    demandSnapshotUnique: unique(
      "skill_demand_snapshots_skill_city_role_seniority_period_key"
    ).on(table.skillId, table.city, table.role, table.seniority, table.periodEnd),
  })
);

export const userSkillGraph = pgTable(
  "user_skill_graph",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skillOntology.id, { onDelete: "cascade" }),
    source: userSkillGraphSourceEnum("source").notNull(),
    proficiency: smallint("proficiency").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userSkillUnique: unique("user_skill_graph_user_id_skill_id_key").on(
      table.userId,
      table.skillId
    ),
    userIdIdx: index("user_skill_graph_user_id_idx").on(table.userId),
    skillIdIdx: index("user_skill_graph_skill_id_idx").on(table.skillId),
    proficiencyRangeCheck: check(
      "user_skill_graph_proficiency_check",
      sql.raw("(proficiency >= 1 AND proficiency <= 5)")
    ),
  })
);

export const skillOntologyRequests = pgTable(
  "skill_ontology_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillName: text("skill_name").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("skill_ontology_requests_user_id_idx").on(table.userId),
    projectIdIdx: index("skill_ontology_requests_project_id_idx").on(
      table.projectId,
    ),
  }),
);

export const skillGapScores = pgTable(
  "skill_gap_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    city: text("city").notNull(),
    gapScore: smallint("gap_score").notNull(),
    rankedSkills: jsonb("ranked_skills")
      .$type<RankedSkill[]>()
      .notNull()
      .default([]),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userRoleCityIdx: index("skill_gap_scores_user_role_city_idx").on(
      table.userId,
      table.role,
      table.city
    ),
    gapScoreRangeCheck: check(
      "skill_gap_scores_gap_score_check",
      sql.raw("(gap_score >= 0 AND gap_score <= 100)")
    ),
  })
);

export const skillOntologyRelations = relations(skillOntology, ({ many }) => ({
  demandSnapshots: many(skillDemandSnapshots),
  userSkillGraphEntries: many(userSkillGraph),
}));

export const skillDemandSnapshotsRelations = relations(
  skillDemandSnapshots,
  ({ one }) => ({
    skill: one(skillOntology, {
      fields: [skillDemandSnapshots.skillId],
      references: [skillOntology.id],
    }),
  })
);

export const userSkillGraphRelations = relations(userSkillGraph, ({ one }) => ({
  user: one(users, {
    fields: [userSkillGraph.userId],
    references: [users.id],
  }),
  skill: one(skillOntology, {
    fields: [userSkillGraph.skillId],
    references: [skillOntology.id],
  }),
}));

export const skillGapScoresRelations = relations(skillGapScores, ({ one }) => ({
  user: one(users, {
    fields: [skillGapScores.userId],
    references: [users.id],
  }),
}));

export const skillOntologyRequestsRelations = relations(
  skillOntologyRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [skillOntologyRequests.userId],
      references: [users.id],
    }),
    project: one(projects, {
      fields: [skillOntologyRequests.projectId],
      references: [projects.id],
    }),
  }),
);

export type SkillOntology = typeof skillOntology.$inferSelect;
export type NewSkillOntology = typeof skillOntology.$inferInsert;

export type JobPostingRaw = typeof jobPostingsRaw.$inferSelect;
export type NewJobPostingRaw = typeof jobPostingsRaw.$inferInsert;

export type SkillDemandSnapshot = typeof skillDemandSnapshots.$inferSelect;
export type NewSkillDemandSnapshot = typeof skillDemandSnapshots.$inferInsert;

export type UserSkillGraphEntry = typeof userSkillGraph.$inferSelect;
export type NewUserSkillGraphEntry = typeof userSkillGraph.$inferInsert;

export type SkillGapScore = typeof skillGapScores.$inferSelect;
export type NewSkillGapScore = typeof skillGapScores.$inferInsert;

export type SkillOntologyRequest = typeof skillOntologyRequests.$inferSelect;
export type NewSkillOntologyRequest =
  typeof skillOntologyRequests.$inferInsert;
