import { eq } from "drizzle-orm";
import {
  numeric,
  pgTable,
  pgView,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "@/db/schema/users";

export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const interviewFeedback = pgTable("interview_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => interviewSessions.id, { onDelete: "cascade" }),
  overallScore: numeric("overall_score", { precision: 3, scale: 1 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Feedback rows joined to session owner — used for leaderboard growth scoring. */
export const interviewReports = pgView("interview_reports").as((qb) =>
  qb
    .select({
      id: interviewFeedback.id,
      userId: interviewSessions.userId,
      overallScore: interviewFeedback.overallScore,
      createdAt: interviewFeedback.createdAt,
    })
    .from(interviewFeedback)
    .innerJoin(
      interviewSessions,
      eq(interviewFeedback.sessionId, interviewSessions.id),
    ),
);

export type InterviewReport = {
  id: string;
  userId: string;
  overallScore: string;
  createdAt: Date;
};
