import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

/** Mirrors `onboarding_profiles` from Supabase migration `001_e1_onboarding.sql`. */
export const onboardingProfiles = pgTable("onboarding_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  targetRole: text("target_role").notNull(),
  currentRole: text("current_role"),
  yearsOfExperience: text("years_of_experience"),
  aiFluency: text("ai_fluency"),
  resumeParsed: jsonb("resume_parsed"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type OnboardingProfile = typeof onboardingProfiles.$inferSelect;
