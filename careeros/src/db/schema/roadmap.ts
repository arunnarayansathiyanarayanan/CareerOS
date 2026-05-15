import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const roadmapTargetRoleEnum = pgEnum("roadmap_target_role", [
  "AI_PM",
  "AI_GENERALIST",
  "AI_ENGINEER",
  "AI_MARKETER",
  "AI_OPERATOR",
  "AI_FOUNDER",
]);

export const roadmapStatusEnum = pgEnum("roadmap_status", [
  "active",
  "stale",
  "failed",
]);

export const roadmapItemTypeEnum = pgEnum("roadmap_item_type", [
  "concept",
  "project",
  "milestone",
]);

export const roadmapItemStatusEnum = pgEnum("roadmap_item_status", [
  "not_started",
  "in_progress",
  "completed",
  "skipped",
]);

export type RoadmapTargetRole =
  (typeof roadmapTargetRoleEnum.enumValues)[number];

export type RoadmapStatus = (typeof roadmapStatusEnum.enumValues)[number];

export type RoadmapItemType = (typeof roadmapItemTypeEnum.enumValues)[number];

export type RoadmapItemStatus =
  (typeof roadmapItemStatusEnum.enumValues)[number];

export type ExternalLink = {
  label: string;
  url: string;
  type: "youtube" | "blog" | "docs";
};

export type CompletionChecklist = Record<string, unknown>;

export const roadmaps = pgTable(
  "roadmaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetRole: roadmapTargetRoleEnum("target_role").notNull(),
    version: integer("version").notNull().default(1),
    aiNativeReadyScore: integer("ai_native_ready_score").notNull().default(0),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastRegenAt: timestamp("last_regen_at", { withTimezone: true }),
    status: roadmapStatusEnum("status").notNull().default("active"),
  },
  (table) => ({
    userIdIdx: index("roadmaps_user_id_idx").on(table.userId),
  })
);

export const roadmapItems = pgTable(
  "roadmap_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roadmapId: uuid("roadmap_id")
      .notNull()
      .references(() => roadmaps.id, { onDelete: "cascade" }),
    type: roadmapItemTypeEnum("type").notNull(),
    phase: text("phase").notNull(),
    phaseOrder: integer("phase_order").notNull(),
    itemOrder: integer("item_order").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    estimatedHours: integer("estimated_hours").notNull(),
    difficulty: integer("difficulty").notNull(),
    dependencies: uuid("dependencies").array().notNull().default([]),
    status: roadmapItemStatusEnum("status").notNull().default("not_started"),
    userNote: text("user_note"),
    externalLinks: jsonb("external_links")
      .$type<ExternalLink[]>()
      .notNull()
      .default([]),
    proofOfWorkUrl: text("proof_of_work_url"),
    techStack: text("tech_stack").array().notNull().default([]),
    completionChecklist: jsonb("completion_checklist")
      .$type<CompletionChecklist>()
      .notNull()
      .default({}),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    roadmapIdTypeIdx: index("roadmap_items_roadmap_id_type_idx").on(
      table.roadmapId,
      table.type
    ),
    roadmapIdPhaseIdx: index("roadmap_items_roadmap_id_phase_idx").on(
      table.roadmapId,
      table.phase
    ),
  })
);

export const roadmapsRelations = relations(roadmaps, ({ one, many }) => ({
  user: one(users, {
    fields: [roadmaps.userId],
    references: [users.id],
  }),
  items: many(roadmapItems),
}));

export const roadmapItemsRelations = relations(roadmapItems, ({ one }) => ({
  roadmap: one(roadmaps, {
    fields: [roadmapItems.roadmapId],
    references: [roadmaps.id],
  }),
}));

export type Roadmap = typeof roadmaps.$inferSelect;
export type NewRoadmap = typeof roadmaps.$inferInsert;

export type RoadmapItem = typeof roadmapItems.$inferSelect;
export type NewRoadmapItem = typeof roadmapItems.$inferInsert;
