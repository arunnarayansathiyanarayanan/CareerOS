import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Mirrors `users` from Supabase migration `001_e1_onboarding.sql` (FK target for roadmaps). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  username: text("username").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
