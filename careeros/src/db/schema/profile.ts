import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { SKILL_ONTOLOGY } from "@/constants/skill-ontology";

import { users } from "./users";

const skillOntologyInCheckSql = SKILL_ONTOLOGY.map(
  (s) => `'${s.replace(/'/g, "''")}'`
).join(", ");

export const profileTargetRoleEnum = pgEnum("profile_target_role", [
  "AI_PM",
  "AI_GENERALIST",
  "AI_ENGINEER",
  "AI_MARKETER",
  "AI_OPERATOR",
  "AI_FOUNDER",
]);

export const profileAvailabilityStatusEnum = pgEnum(
  "profile_availability_status",
  ["OPEN_TO_ROLES", "OPEN_TO_COLLABS", "HEADS_DOWN"]
);

export const profileVisibilityEnum = pgEnum("profile_visibility", [
  "PUBLIC",
  "PRIVATE",
  "ANONYMOUS",
]);

export const profileViewSourceEnum = pgEnum("profile_view_source", [
  "DIRECT",
  "LINKEDIN",
  "TWITTER",
  "WHATSAPP",
  "GOOGLE",
  "OTHER",
]);

export const skillGraphSourceEnum = pgEnum("skill_graph_source", [
  "DECLARED",
  "PROJECT_TAG",
  "ENDORSEMENT",
]);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 24 }).notNull().unique(),
    headline: varchar("headline", { length: 160 }),
    targetRole: profileTargetRoleEnum("target_role").notNull(),
    location: varchar("location", { length: 100 }),
    availabilityStatus: profileAvailabilityStatusEnum("availability_status")
      .notNull()
      .default("HEADS_DOWN"),
    visibility: profileVisibilityEnum("visibility").notNull().default("PUBLIC"),
    customDomain: varchar("custom_domain", { length: 255 }).unique(),
    aiNativeVerified: boolean("ai_native_verified").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    streakDays: integer("streak_days").notNull().default(0),
    streakLastActivity: date("streak_last_activity"),
    roadmapProgressPct: smallint("roadmap_progress_pct").notNull().default(0),
    pinnedProjectIds: uuid("pinned_project_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    usernameFormatCheck: check(
      "profiles_username_format_check",
      sql.raw(`username ~ '^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$'`)
    ),
    pinnedLenCheck: check(
      "profiles_pinned_project_ids_len_check",
      sql.raw("cardinality(pinned_project_ids) <= 5")
    ),
    roadmapProgressCheck: check(
      "profiles_roadmap_progress_pct_check",
      sql.raw(
        "(roadmap_progress_pct >= 0 AND roadmap_progress_pct <= 100)"
      )
    ),
    usernameNonAnonymousIdx: index("profiles_username_non_anonymous_idx")
      .on(table.username)
      .where(sql`visibility <> 'ANONYMOUS'`),
  })
);

export const profileViews = pgTable(
  "profile_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    viewerId: uuid("viewer_id").references(() => users.id, {
      onDelete: "set null",
    }),
    source: profileViewSourceEnum("source").notNull(),
    referrerUrl: text("referrer_url"),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  },
  (table) => ({
    profileIdIdx: index("profile_views_profile_id_idx").on(table.profileId),
    profileIdViewedAtDescIdx: index(
      "profile_views_profile_id_viewed_at_desc_idx"
    ).on(
      table.profileId,
      // @ts-expect-error IndexColumn typings omit DESC SQL fragments; matches migration btree (profile_id, viewed_at DESC)
      sql`${table.viewedAt} DESC`
    ),
    viewedAtIdx: index("profile_views_viewed_at_idx").on(table.viewedAt),
  })
);

export const endorsements = pgTable(
  "endorsements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toProfileId: uuid("to_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    skill: varchar("skill", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    fromToSkillUnique: unique("endorsements_from_user_to_profile_skill_key").on(
      table.fromUserId,
      table.toProfileId,
      table.skill
    ),
    skillOntologyCheck: check(
      "endorsements_skill_ontology_check",
      sql.raw(`skill IN (${skillOntologyInCheckSql})`)
    ),
  })
);

export const skillGraphEntries = pgTable(
  "skill_graph_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    skill: varchar("skill", { length: 100 }).notNull(),
    source: skillGraphSourceEnum("source").notNull(),
    proficiency: smallint("proficiency"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    profileSkillUnique: unique("skill_graph_entries_profile_id_skill_key").on(
      table.profileId,
      table.skill
    ),
    profileIdIdx: index("skill_graph_entries_profile_id_idx").on(
      table.profileId
    ),
    skillOntologyCheck: check(
      "skill_graph_entries_skill_ontology_check",
      sql.raw(`skill IN (${skillOntologyInCheckSql})`)
    ),
    proficiencyRangeCheck: check(
      "skill_graph_entries_proficiency_check",
      sql.raw(
        "(proficiency IS NULL OR (proficiency >= 1 AND proficiency <= 5))"
      )
    ),
  })
);

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  views: many(profileViews),
  endorsementsReceived: many(endorsements),
  skillGraphEntries: many(skillGraphEntries),
}));

export const profileViewsRelations = relations(profileViews, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileViews.profileId],
    references: [profiles.id],
  }),
  viewer: one(users, {
    fields: [profileViews.viewerId],
    references: [users.id],
  }),
}));

export const endorsementsRelations = relations(endorsements, ({ one }) => ({
  fromUser: one(users, {
    fields: [endorsements.fromUserId],
    references: [users.id],
  }),
  toProfile: one(profiles, {
    fields: [endorsements.toProfileId],
    references: [profiles.id],
  }),
}));

export const skillGraphEntriesRelations = relations(
  skillGraphEntries,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [skillGraphEntries.profileId],
      references: [profiles.id],
    }),
  })
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type ProfileView = typeof profileViews.$inferSelect;
export type NewProfileView = typeof profileViews.$inferInsert;

export type Endorsement = typeof endorsements.$inferSelect;
export type NewEndorsement = typeof endorsements.$inferInsert;

export type SkillGraphEntry = typeof skillGraphEntries.$inferSelect;
export type NewSkillGraphEntry = typeof skillGraphEntries.$inferInsert;
