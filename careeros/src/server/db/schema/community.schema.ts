import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { projects } from "@/db/schema/projects";
import { users } from "@/db/schema/users";

export const roleEnum = pgEnum("role", [
  "AI_PM",
  "AI_GENERALIST",
  "AI_ENGINEER",
  "AI_MARKETER",
  "AI_OPERATOR",
  "AI_FOUNDER",
]);

export const challengeStatusEnum = pgEnum("challenge_status", [
  "UPCOMING",
  "ACTIVE",
  "VOTING",
  "CLOSED",
]);

export const streakEventTypeEnum = pgEnum("streak_event_type", [
  "CONCEPT_COMPLETE",
  "PROJECT_PUBLISHED",
  "INTERVIEW_DONE",
  "FEED_POST",
]);

export const privacyModeEnum = pgEnum("privacy_mode", [
  "PUBLIC",
  "UNLISTED",
  "RECRUITER_SHARE",
]);

export const reactionTypeEnum = pgEnum("reaction_type", ["LIKE", "INSPIRING"]);

export const contentTypeEnum = pgEnum("content_type", [
  "POST",
  "COMMENT",
  "PROJECT",
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "OPEN",
  "RESOLVED",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "PENDING",
  "COMPLETED",
]);

export type Role = (typeof roleEnum.enumValues)[number];
export type ChallengeStatus = (typeof challengeStatusEnum.enumValues)[number];
export type StreakEventType = (typeof streakEventTypeEnum.enumValues)[number];
export type PrivacyMode = (typeof privacyModeEnum.enumValues)[number];
export type ReactionType = (typeof reactionTypeEnum.enumValues)[number];
export type ContentType = (typeof contentTypeEnum.enumValues)[number];
export type ModerationStatus = (typeof moderationStatusEnum.enumValues)[number];
export type ReviewStatus = (typeof reviewStatusEnum.enumValues)[number];

export type PeerReviewRubricScores = {
  relevance: number;
  execution: number;
  documentation: number;
  impact: number;
};

export const cohorts = pgTable(
  "cohorts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    targetRole: roleEnum("target_role").notNull(),
    timezone: text("timezone").notNull(),
    signupWeek: text("signup_week").notNull(),
    maxSize: integer("max_size").notNull().default(80),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    targetRoleTimezoneSignupWeekIdx: index(
      "cohorts_target_role_timezone_signup_week_idx"
    ).on(table.targetRole, table.timezone, table.signupWeek),
  })
);

export const cohortMembers = pgTable(
  "cohort_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cohortId: text("cohort_id")
      .notNull()
      .references(() => cohorts.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    // Partial unique (user_id) WHERE is_active = true — add in Supabase migration:
    // CREATE UNIQUE INDEX cohort_members_user_id_active_unique ON cohort_members (user_id) WHERE is_active = true;
    userIdIsActiveUnique: uniqueIndex(
      "cohort_members_user_id_is_active_unique"
    ).on(table.userId, table.isActive),
    userIdIdx: index("cohort_members_user_id_idx").on(table.userId),
    cohortIdIdx: index("cohort_members_cohort_id_idx").on(table.cohortId),
  })
);

export const buildChallenges = pgTable(
  "build_challenges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    title: text("title").notNull(),
    description: text("description").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    submissionDeadline: timestamp("submission_deadline", {
      withTimezone: true,
    }).notNull(),
    votingDeadline: timestamp("voting_deadline", { withTimezone: true }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: challengeStatusEnum("status").notNull().default("UPCOMING"),
  },
  (table) => ({
    createdByIdx: index("build_challenges_created_by_idx").on(table.createdBy),
    statusIdx: index("build_challenges_status_idx").on(table.status),
  })
);

export const challengeSubmissions = pgTable(
  "challenge_submissions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => buildChallenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    voteCount: integer("vote_count").notNull().default(0),
  },
  (table) => ({
    challengeIdUserIdUnique: uniqueIndex(
      "challenge_submissions_challenge_id_user_id_unique"
    ).on(table.challengeId, table.userId),
    challengeIdIdx: index("challenge_submissions_challenge_id_idx").on(
      table.challengeId
    ),
    userIdIdx: index("challenge_submissions_user_id_idx").on(table.userId),
    projectIdIdx: index("challenge_submissions_project_id_idx").on(
      table.projectId
    ),
  })
);

export const challengeVotes = pgTable(
  "challenge_votes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    submissionId: text("submission_id")
      .notNull()
      .references(() => challengeSubmissions.id, { onDelete: "cascade" }),
    voterId: text("voter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    submissionIdVoterIdUnique: uniqueIndex(
      "challenge_votes_submission_id_voter_id_unique"
    ).on(table.submissionId, table.voterId),
    voterIdIdx: index("challenge_votes_voter_id_idx").on(table.voterId),
  })
);

export const streaks = pgTable(
  "streaks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    lastShipDate: text("last_ship_date"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdUnique: uniqueIndex("streaks_user_id_unique").on(table.userId),
  })
);

export const streakEvents = pgTable(
  "streak_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: streakEventTypeEnum("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => ({
    userIdOccurredAtIdx: index("streak_events_user_id_occurred_at_idx").on(
      table.userId,
      table.occurredAt
    ),
  })
);

export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cohortId: text("cohort_id")
      .notNull()
      .references(() => cohorts.id, { onDelete: "cascade" }),
    score: real("score").notNull().default(0),
    projectsShipped: integer("projects_shipped").notNull().default(0),
    projectQualitySum: real("project_quality_sum").notNull().default(0),
    interviewScoreGrowth: real("interview_score_growth").notNull().default(0),
    communityContribution: real("community_contribution").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdCohortIdUnique: uniqueIndex(
      "leaderboard_entries_user_id_cohort_id_unique"
    ).on(table.userId, table.cohortId),
    cohortIdScoreIdx: index("leaderboard_entries_cohort_id_score_idx").on(
      table.cohortId,
      table.score
    ),
    userIdIdx: index("leaderboard_entries_user_id_idx").on(table.userId),
    computedAtIdx: index("leaderboard_entries_computed_at_idx").on(
      table.computedAt
    ),
  })
);

export const communityPosts = pgTable(
  "community_posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cohortId: text("cohort_id").references(() => cohorts.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    linkedProjectId: text("linked_project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    taggedSkills: text("tagged_skills").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    isDeleted: boolean("is_deleted").notNull().default(false),
  },
  (table) => ({
    cohortIdCreatedAtIdx: index("community_posts_cohort_id_created_at_idx").on(
      table.cohortId,
      table.createdAt
    ),
    userIdIdx: index("community_posts_user_id_idx").on(table.userId),
  })
);

export const postReactions = pgTable(
  "post_reactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    postId: text("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: reactionTypeEnum("type").notNull(),
  },
  (table) => ({
    postIdUserIdTypeUnique: uniqueIndex(
      "post_reactions_post_id_user_id_type_unique"
    ).on(table.postId, table.userId, table.type),
    userIdIdx: index("post_reactions_user_id_idx").on(table.userId),
  })
);

export const postComments = pgTable(
  "post_comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    postId: text("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    isDeleted: boolean("is_deleted").notNull().default(false),
  },
  (table) => ({
    postIdIdx: index("post_comments_post_id_idx").on(table.postId),
    userIdIdx: index("post_comments_user_id_idx").on(table.userId),
  })
);

export const reviewCredits = pgTable(
  "review_credits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    reviewCountSinceLastGrant: integer("review_count_since_last_grant")
      .notNull()
      .default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdUnique: uniqueIndex("review_credits_user_id_unique").on(table.userId),
  })
);

export const peerReviews = pgTable(
  "peer_reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    rubricScores: jsonb("rubric_scores")
      .$type<PeerReviewRubricScores>()
      .notNull(),
    overallScore: real("overall_score").notNull(),
    strengths: text("strengths").array().notNull().default([]),
    improvements: text("improvements").array().notNull().default([]),
    status: reviewStatusEnum("status").notNull().default("PENDING"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    projectIdStatusIdx: index("peer_reviews_project_id_status_idx").on(
      table.projectId,
      table.status
    ),
    reviewerIdIdx: index("peer_reviews_reviewer_id_idx").on(table.reviewerId),
  })
);

export const moderationReports = pgTable(
  "moderation_reports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentType: contentTypeEnum("content_type").notNull(),
    contentId: text("content_id").notNull(),
    reason: text("reason").notNull(),
    status: moderationStatusEnum("status").notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    reporterIdIdx: index("moderation_reports_reporter_id_idx").on(
      table.reporterId
    ),
    contentTypeContentIdIdx: index(
      "moderation_reports_content_type_content_id_idx"
    ).on(table.contentType, table.contentId),
    statusIdx: index("moderation_reports_status_idx").on(table.status),
  })
);

export const curationSignals = pgTable(
  "curation_signals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    postId: text("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    signalType: text("signal_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    postIdIdx: index("curation_signals_post_id_idx").on(table.postId),
  })
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIsReadIdx: index("notifications_user_id_is_read_idx").on(
      table.userId,
      table.isRead
    ),
  })
);

export const cohortsRelations = relations(cohorts, ({ many }) => ({
  members: many(cohortMembers),
  leaderboardEntries: many(leaderboardEntries),
  communityPosts: many(communityPosts),
}));

export const cohortMembersRelations = relations(cohortMembers, ({ one }) => ({
  user: one(users, {
    fields: [cohortMembers.userId],
    references: [users.id],
  }),
  cohort: one(cohorts, {
    fields: [cohortMembers.cohortId],
    references: [cohorts.id],
  }),
}));

export const buildChallengesRelations = relations(
  buildChallenges,
  ({ one, many }) => ({
    creator: one(users, {
      fields: [buildChallenges.createdBy],
      references: [users.id],
    }),
    submissions: many(challengeSubmissions),
  })
);

export const challengeSubmissionsRelations = relations(
  challengeSubmissions,
  ({ one, many }) => ({
    challenge: one(buildChallenges, {
      fields: [challengeSubmissions.challengeId],
      references: [buildChallenges.id],
    }),
    user: one(users, {
      fields: [challengeSubmissions.userId],
      references: [users.id],
    }),
    project: one(projects, {
      fields: [challengeSubmissions.projectId],
      references: [projects.id],
    }),
    votes: many(challengeVotes),
  })
);

export const challengeVotesRelations = relations(challengeVotes, ({ one }) => ({
  submission: one(challengeSubmissions, {
    fields: [challengeVotes.submissionId],
    references: [challengeSubmissions.id],
  }),
  voter: one(users, {
    fields: [challengeVotes.voterId],
    references: [users.id],
  }),
}));

export const streaksRelations = relations(streaks, ({ one }) => ({
  user: one(users, {
    fields: [streaks.userId],
    references: [users.id],
  }),
}));

export const streakEventsRelations = relations(streakEvents, ({ one }) => ({
  user: one(users, {
    fields: [streakEvents.userId],
    references: [users.id],
  }),
}));

export const leaderboardEntriesRelations = relations(
  leaderboardEntries,
  ({ one }) => ({
    user: one(users, {
      fields: [leaderboardEntries.userId],
      references: [users.id],
    }),
    cohort: one(cohorts, {
      fields: [leaderboardEntries.cohortId],
      references: [cohorts.id],
    }),
  })
);

export const communityPostsRelations = relations(
  communityPosts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [communityPosts.userId],
      references: [users.id],
    }),
    cohort: one(cohorts, {
      fields: [communityPosts.cohortId],
      references: [cohorts.id],
    }),
    linkedProject: one(projects, {
      fields: [communityPosts.linkedProjectId],
      references: [projects.id],
    }),
    reactions: many(postReactions),
    comments: many(postComments),
    curationSignals: many(curationSignals),
  })
);

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(communityPosts, {
    fields: [postReactions.postId],
    references: [communityPosts.id],
  }),
  user: one(users, {
    fields: [postReactions.userId],
    references: [users.id],
  }),
}));

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(communityPosts, {
    fields: [postComments.postId],
    references: [communityPosts.id],
  }),
  user: one(users, {
    fields: [postComments.userId],
    references: [users.id],
  }),
}));

export const reviewCreditsRelations = relations(reviewCredits, ({ one }) => ({
  user: one(users, {
    fields: [reviewCredits.userId],
    references: [users.id],
  }),
}));

export const peerReviewsRelations = relations(peerReviews, ({ one }) => ({
  reviewer: one(users, {
    fields: [peerReviews.reviewerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [peerReviews.projectId],
    references: [projects.id],
  }),
}));

export const moderationReportsRelations = relations(
  moderationReports,
  ({ one }) => ({
    reporter: one(users, {
      fields: [moderationReports.reporterId],
      references: [users.id],
    }),
  })
);

export const curationSignalsRelations = relations(curationSignals, ({ one }) => ({
  post: one(communityPosts, {
    fields: [curationSignals.postId],
    references: [communityPosts.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const communityRelations = {
  cohortsRelations,
  cohortMembersRelations,
  buildChallengesRelations,
  challengeSubmissionsRelations,
  challengeVotesRelations,
  streaksRelations,
  streakEventsRelations,
  leaderboardEntriesRelations,
  communityPostsRelations,
  postReactionsRelations,
  postCommentsRelations,
  reviewCreditsRelations,
  peerReviewsRelations,
  moderationReportsRelations,
  curationSignalsRelations,
  notificationsRelations,
};

export type Cohort = typeof cohorts.$inferSelect;
export type NewCohort = typeof cohorts.$inferInsert;

export type CohortMember = typeof cohortMembers.$inferSelect;
export type NewCohortMember = typeof cohortMembers.$inferInsert;

export type BuildChallenge = typeof buildChallenges.$inferSelect;
export type NewBuildChallenge = typeof buildChallenges.$inferInsert;

export type ChallengeSubmission = typeof challengeSubmissions.$inferSelect;
export type NewChallengeSubmission = typeof challengeSubmissions.$inferInsert;

export type ChallengeVote = typeof challengeVotes.$inferSelect;
export type NewChallengeVote = typeof challengeVotes.$inferInsert;

export type Streak = typeof streaks.$inferSelect;
export type NewStreak = typeof streaks.$inferInsert;

export type StreakEvent = typeof streakEvents.$inferSelect;
export type NewStreakEvent = typeof streakEvents.$inferInsert;

export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
export type NewLeaderboardEntry = typeof leaderboardEntries.$inferInsert;

export type CommunityPost = typeof communityPosts.$inferSelect;
export type NewCommunityPost = typeof communityPosts.$inferInsert;

export type PostReaction = typeof postReactions.$inferSelect;
export type NewPostReaction = typeof postReactions.$inferInsert;

export type PostComment = typeof postComments.$inferSelect;
export type NewPostComment = typeof postComments.$inferInsert;

export type ReviewCredit = typeof reviewCredits.$inferSelect;
export type NewReviewCredit = typeof reviewCredits.$inferInsert;

export type PeerReview = typeof peerReviews.$inferSelect;
export type NewPeerReview = typeof peerReviews.$inferInsert;

export type ModerationReport = typeof moderationReports.$inferSelect;
export type NewModerationReport = typeof moderationReports.$inferInsert;

export type CurationSignal = typeof curationSignals.$inferSelect;
export type NewCurationSignal = typeof curationSignals.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
