import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "trialing",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", ["pro"]);

export type SubscriptionStatus =
  (typeof subscriptionStatusEnum.enumValues)[number];

export type SubscriptionPlan =
  (typeof subscriptionPlanEnum.enumValues)[number];

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    plan: subscriptionPlanEnum("plan").notNull().default("pro"),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIdx: index("subscriptions_status_idx").on(table.status),
  }),
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    intelligenceEmails: boolean("intelligence_emails").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    intelligenceEmailsIdx: index(
      "notification_preferences_intelligence_emails_idx",
    ).on(table.intelligenceEmails),
  }),
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NotificationPreferences =
  typeof notificationPreferences.$inferSelect;
