import { createId as cuid } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { profiles } from "@/db/schema/profile";
import { projects } from "@/db/schema/projects";
import { users } from "@/db/schema/users";
import { openai } from "@/lib/ai/openai-client";
import { getClerkAppSession } from "@/lib/auth";
import {
  buildChallenges,
  challengeSubmissions,
  challengeVotes,
  communityPosts,
  curationSignals,
  leaderboardEntries,
  moderationReports,
  postComments,
  postReactions,
} from "@/server/db/schema/community.schema";
import { redis } from "@/server/redis";
import * as cohortService from "@/server/services/cohort.service";
import * as leaderboardService from "@/server/services/leaderboard.service";
import * as streakService from "@/server/services/streak.service";

import { protectedProcedure, publicProcedure, router } from "../trpc";

async function resolveAuthedUserId(): Promise<string | undefined> {
  const session = await getClerkAppSession();
  if (session.status === "authenticated") return session.appUser.id;
  return undefined;
}

async function moderateContent(text: string): Promise<void> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You are a content moderator. Reply ONLY with JSON: {"safe": boolean, "reason": string}',
        },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      max_tokens: 100,
    });
    const result = JSON.parse(
      res.choices[0]?.message?.content ?? '{"safe":true}',
    ) as { safe?: boolean };
    if (!result.safe) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Content violates community guidelines.",
      });
    }
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    // fail open on OpenAI errors
  }
}

export const communityRouter = router({
  post: router({
    create: protectedProcedure
      .input(
        z.object({
          content: z.string().min(1).max(2000),
          cohortId: z.string().optional(),
          linkedProjectId: z.string().optional(),
          taggedSkills: z.array(z.string()).max(10).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.appUser.id;

        const key = `ratelimit:post:${userId}`;
        const postCount = await redis.incr(key);
        if (postCount === 1) await redis.expire(key, 86400);
        if (postCount > 10) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Max 10 posts per day",
          });
        }

        await moderateContent(input.content);

        const [profile] = await ctx.db
          .select({ targetRole: profiles.targetRole })
          .from(profiles)
          .where(eq(profiles.userId, userId))
          .limit(1);

        if (!profile?.targetRole) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Complete onboarding before posting.",
          });
        }

        const [post] = await ctx.db
          .insert(communityPosts)
          .values({
            userId,
            content: input.content,
            cohortId: input.cohortId ?? null,
            linkedProjectId: input.linkedProjectId ?? null,
            taggedSkills: input.taggedSkills,
          })
          .returning();

        if (!post) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create post.",
          });
        }

        await streakService.recordStreakEvent(userId, "FEED_POST", {
          postId: post.id,
        });

        return post;
      }),

    getFeed: protectedProcedure
      .input(
        z.object({
          cohortId: z.string().optional(),
          cursor: z.string().datetime().optional(),
          limit: z.number().max(50).default(20),
        }),
      )
      .query(async ({ ctx, input }) => {
        const conditions = [eq(communityPosts.isDeleted, false)];
        if (input.cohortId) {
          conditions.push(eq(communityPosts.cohortId, input.cohortId));
        }
        if (input.cursor) {
          conditions.push(
            sql`${communityPosts.createdAt} < ${new Date(input.cursor)}`,
          );
        }

        const rows = await ctx.db
          .select()
          .from(communityPosts)
          .where(and(...conditions))
          .orderBy(desc(communityPosts.createdAt))
          .limit(input.limit + 1);

        const page = rows.slice(0, input.limit);
        const postIds = page.map((p) => p.id);

        const likeCounts = new Map<string, number>();
        const inspiringCounts = new Map<string, number>();
        const commentCounts = new Map<string, number>();

        if (postIds.length > 0) {
          const [likes, inspiring, comments] = await Promise.all([
            ctx.db
              .select({
                postId: postReactions.postId,
                value: count(),
              })
              .from(postReactions)
              .where(
                and(
                  eq(postReactions.type, "LIKE"),
                  inArray(postReactions.postId, postIds),
                ),
              )
              .groupBy(postReactions.postId),
            ctx.db
              .select({
                postId: postReactions.postId,
                value: count(),
              })
              .from(postReactions)
              .where(
                and(
                  eq(postReactions.type, "INSPIRING"),
                  inArray(postReactions.postId, postIds),
                ),
              )
              .groupBy(postReactions.postId),
            ctx.db
              .select({
                postId: postComments.postId,
                value: count(),
              })
              .from(postComments)
              .where(
                and(
                  eq(postComments.isDeleted, false),
                  inArray(postComments.postId, postIds),
                ),
              )
              .groupBy(postComments.postId),
          ]);

          for (const row of likes) {
            likeCounts.set(row.postId, Number(row.value));
          }
          for (const row of inspiring) {
            inspiringCounts.set(row.postId, Number(row.value));
          }
          for (const row of comments) {
            commentCounts.set(row.postId, Number(row.value));
          }
        }

        const userIds = [...new Set(page.map((p) => p.userId))];
        const linkedProjectIds = [
          ...new Set(
            page
              .map((p) => p.linkedProjectId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];

        const authorByUserId = new Map<
          string,
          {
            displayName: string;
            imageUrl: string | null;
            targetRole: string;
            username: string;
          }
        >();
        const projectById = new Map<
          string,
          { title: string; slug: string }
        >();
        const userLiked = new Set<string>();
        const userInspiring = new Set<string>();

        const viewerId = ctx.appUser.id;

        if (postIds.length > 0) {
          const viewerReactions = await ctx.db
            .select({
              postId: postReactions.postId,
              type: postReactions.type,
            })
            .from(postReactions)
            .where(
              and(
                eq(postReactions.userId, viewerId),
                inArray(postReactions.postId, postIds),
              ),
            );

          for (const row of viewerReactions) {
            if (row.type === "LIKE") userLiked.add(row.postId);
            if (row.type === "INSPIRING") userInspiring.add(row.postId);
          }
        }

        if (userIds.length > 0) {
          const authorRows = await ctx.db
            .select({
              userId: profiles.userId,
              username: profiles.username,
              targetRole: profiles.targetRole,
              clerkId: users.clerkId,
            })
            .from(profiles)
            .innerJoin(users, eq(users.id, profiles.userId))
            .where(inArray(profiles.userId, userIds));

          for (const row of authorRows) {
            let displayName = row.username;
            let imageUrl: string | null = null;
            if (row.clerkId) {
              try {
                const { clerkClient } = await import("@clerk/nextjs/server");
                const c = await clerkClient();
                const cu = await c.users.getUser(row.clerkId);
                const full = [cu.firstName, cu.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
                displayName =
                  full ||
                  (cu.username ? String(cu.username) : null) ||
                  row.username;
                imageUrl = cu.imageUrl?.length ? cu.imageUrl : null;
              } catch {
                /* Clerk unavailable */
              }
            }
            authorByUserId.set(row.userId, {
              displayName,
              imageUrl,
              targetRole: row.targetRole,
              username: row.username,
            });
          }
        }

        if (linkedProjectIds.length > 0) {
          const linkedRows = await ctx.db
            .select({
              id: projects.id,
              title: projects.title,
              slug: projects.slug,
            })
            .from(projects)
            .where(inArray(projects.id, linkedProjectIds));

          for (const row of linkedRows) {
            projectById.set(row.id, { title: row.title, slug: row.slug });
          }
        }

        const posts = page.map((post) => {
          const author = authorByUserId.get(post.userId);
          const linkedProject = post.linkedProjectId
            ? (projectById.get(post.linkedProjectId) ?? null)
            : null;

          return {
            ...post,
            likeCount: likeCounts.get(post.id) ?? 0,
            inspiringCount: inspiringCounts.get(post.id) ?? 0,
            commentCount: commentCounts.get(post.id) ?? 0,
            author: author ?? {
              displayName: "Builder",
              imageUrl: null,
              targetRole: "AI_GENERALIST",
              username: "builder",
            },
            linkedProject,
            userHasLiked: userLiked.has(post.id),
            userHasInspiring: userInspiring.has(post.id),
          };
        });

        return {
          posts,
          nextCursor: rows[input.limit]?.createdAt.toISOString() ?? null,
        };
      }),

    react: protectedProcedure
      .input(
        z.object({
          postId: z.string(),
          type: z.enum(["LIKE", "INSPIRING"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.appUser.id;
        const { postId, type } = input;

        await ctx.db
          .insert(postReactions)
          .values({ id: cuid(), postId, userId, type })
          .onConflictDoNothing();

        if (type === "INSPIRING") {
          await ctx.db.insert(curationSignals).values({
            id: cuid(),
            postId,
            signalType: "INSPIRING",
          });
        }

        return { success: true as const };
      }),

    report: protectedProcedure
      .input(
        z.object({
          contentType: z.enum(["POST", "COMMENT", "PROJECT"]),
          contentId: z.string(),
          reason: z.string().max(500),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.appUser.id;

        await ctx.db.insert(moderationReports).values({
          id: cuid(),
          reporterId: userId,
          contentType: input.contentType,
          contentId: input.contentId,
          reason: input.reason,
        });

        return { success: true as const };
      }),
  }),

  challenge: router({
    getCurrent: publicProcedure.query(async ({ ctx }) => {
      const statusPriority = sql`CASE ${buildChallenges.status}
        WHEN 'ACTIVE' THEN 0
        WHEN 'VOTING' THEN 1
        WHEN 'CLOSED' THEN 2
        ELSE 3
      END`;

      const [challenge] = await ctx.db
        .select()
        .from(buildChallenges)
        .where(inArray(buildChallenges.status, ["ACTIVE", "VOTING", "CLOSED"]))
        .orderBy(statusPriority, desc(buildChallenges.startsAt))
        .limit(1);

      if (!challenge) {
        return {
          challenge: null,
          submissionCount: 0,
          userHasSubmitted: false,
        };
      }

      const [submissionStats] = await ctx.db
        .select({ value: count() })
        .from(challengeSubmissions)
        .where(eq(challengeSubmissions.challengeId, challenge.id));

      const submissionCount = Number(submissionStats?.value ?? 0);

      const userId = await resolveAuthedUserId();
      let userHasSubmitted = false;
      if (userId) {
        const [existing] = await ctx.db
          .select({ id: challengeSubmissions.id })
          .from(challengeSubmissions)
          .where(
            and(
              eq(challengeSubmissions.challengeId, challenge.id),
              eq(challengeSubmissions.userId, userId),
            ),
          )
          .limit(1);
        userHasSubmitted = Boolean(existing);
      }

      return { challenge, submissionCount, userHasSubmitted };
    }),

    submit: protectedProcedure
      .input(
        z.object({
          challengeId: z.string(),
          projectId: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.appUser.id;

        const [challenge] = await ctx.db
          .select()
          .from(buildChallenges)
          .where(eq(buildChallenges.id, input.challengeId))
          .limit(1);

        if (!challenge || challenge.status !== "ACTIVE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Challenge is not accepting submissions.",
          });
        }

        if (new Date() >= challenge.submissionDeadline) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Submission deadline has passed.",
          });
        }

        const [project] = await ctx.db
          .select({
            userId: projects.userId,
            aiReviewerScore: projects.aiReviewerScore,
          })
          .from(projects)
          .where(
            and(
              eq(projects.id, input.projectId),
              eq(projects.userId, userId),
              eq(projects.isDeleted, false),
            ),
          )
          .limit(1);

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found.",
          });
        }

        if ((project.aiReviewerScore ?? 0) < 5) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project must have an AI reviewer score of at least 5.",
          });
        }

        const [submission] = await ctx.db
          .insert(challengeSubmissions)
          .values({
            challengeId: input.challengeId,
            userId,
            projectId: input.projectId,
          })
          .returning();

        if (!submission) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to submit challenge entry.",
          });
        }

        return submission;
      }),

    vote: protectedProcedure
      .input(z.object({ submissionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const voterId = ctx.appUser.id;
        const { submissionId } = input;

        const [submission] = await ctx.db
          .select({ challengeId: challengeSubmissions.challengeId })
          .from(challengeSubmissions)
          .where(eq(challengeSubmissions.id, submissionId))
          .limit(1);

        if (!submission) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Submission not found.",
          });
        }

        const [challenge] = await ctx.db
          .select({ status: buildChallenges.status })
          .from(buildChallenges)
          .where(eq(buildChallenges.id, submission.challengeId))
          .limit(1);

        if (!challenge || challenge.status !== "VOTING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Challenge is not in voting phase.",
          });
        }

        const [inserted] = await ctx.db
          .insert(challengeVotes)
          .values({ id: cuid(), submissionId, voterId })
          .onConflictDoNothing()
          .returning();

        if (inserted) {
          await ctx.db
            .update(challengeSubmissions)
            .set({
              voteCount: sql`${challengeSubmissions.voteCount} + 1`,
            })
            .where(eq(challengeSubmissions.id, submissionId));
        }

        return { success: true as const };
      }),
  }),

  streak: router({
    getMine: protectedProcedure.query(async ({ ctx }) => {
      return streakService.getUserStreak(ctx.appUser.id);
    }),

    getRecentEvents: protectedProcedure
      .input(z.object({ limit: z.number().max(50).default(30) }))
      .query(async ({ ctx, input }) => {
        return streakService.getRecentStreakEvents(ctx.appUser.id, input.limit);
      }),
  }),

  cohort: router({
    getUser: protectedProcedure.query(async ({ ctx }) => {
      const { cohort, members } = await cohortService.getUserCohort(
        ctx.appUser.id,
      );

      const memberUserIds = members.map((m) => m.userId);
      const profileByUserId = new Map<
        string,
        { username: string; displayName: string; imageUrl: string | null }
      >();

      if (memberUserIds.length > 0) {
        const profileRows = await ctx.db
          .select({
            userId: profiles.userId,
            username: profiles.username,
            clerkId: users.clerkId,
          })
          .from(profiles)
          .innerJoin(users, eq(users.id, profiles.userId))
          .where(inArray(profiles.userId, memberUserIds));

        for (const row of profileRows) {
          let displayName = row.username;
          let imageUrl: string | null = null;
          if (row.clerkId) {
            try {
              const { clerkClient } = await import("@clerk/nextjs/server");
              const c = await clerkClient();
              const cu = await c.users.getUser(row.clerkId);
              const full = [cu.firstName, cu.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
              displayName =
                full ||
                (cu.username ? String(cu.username) : null) ||
                row.username;
              imageUrl = cu.imageUrl?.length ? cu.imageUrl : null;
            } catch {
              /* Clerk unavailable */
            }
          }
          profileByUserId.set(row.userId, {
            username: row.username,
            displayName,
            imageUrl,
          });
        }
      }

      return {
        cohort,
        memberCount: members.length,
        members: members.map((member) => {
          const profile = profileByUserId.get(member.userId);
          return {
            userId: member.userId,
            username: profile?.username ?? "builder",
            displayName: profile?.displayName ?? "Builder",
            imageUrl: profile?.imageUrl ?? null,
          };
        }),
      };
    }),

    leave: protectedProcedure.mutation(async ({ ctx }) => {
      await cohortService.leaveCohort(ctx.appUser.id);
      return { success: true as const };
    }),
  }),

  leaderboard: router({
    getCohort: protectedProcedure
      .input(
        z.object({
          cohortId: z.string(),
          limit: z.number().max(100).default(50),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(async ({ ctx, input }) => {
        const allRows = await leaderboardService.getCohortLeaderboardAll(
          input.cohortId,
        );
        const rows = allRows.slice(input.offset, input.offset + input.limit);
        const totalCount = allRows.length;

        const userIds = rows.map((r) => r.userId);
        const profileByUserId = new Map<
          string,
          { username: string; targetRole: string }
        >();

        if (userIds.length > 0) {
          const profileRows = await ctx.db
            .select({
              userId: profiles.userId,
              username: profiles.username,
              targetRole: profiles.targetRole,
            })
            .from(profiles)
            .where(inArray(profiles.userId, userIds));

          for (const row of profileRows) {
            profileByUserId.set(row.userId, {
              username: row.username,
              targetRole: row.targetRole,
            });
          }
        }

        const entries = rows.map((row, index) => {
          const profile = profileByUserId.get(row.userId);
          return {
            ...row,
            rank: input.offset + index + 1,
            displayName: profile?.username ?? "Builder",
            targetRole: profile?.targetRole ?? "AI_GENERALIST",
            imageUrl: null as string | null,
          };
        });

        const viewerId = ctx.appUser.id;
        const viewerInList = entries.some((e) => e.userId === viewerId);
        let currentUserEntry: (typeof entries)[number] | null = null;

        if (!viewerInList) {
          const mine = allRows.find((r) => r.userId === viewerId);
          if (mine) {
            const [profile] = await ctx.db
              .select({
                username: profiles.username,
                targetRole: profiles.targetRole,
              })
              .from(profiles)
              .where(eq(profiles.userId, viewerId))
              .limit(1);

            const rank = allRows.findIndex((r) => r.userId === viewerId) + 1;

            currentUserEntry = {
              ...mine,
              rank: rank || allRows.length + 1,
              displayName: profile?.username ?? "You",
              targetRole: profile?.targetRole ?? "AI_GENERALIST",
              imageUrl: null,
            };
          }
        }

        const computedAt =
          entries[0]?.computedAt ??
          allRows[0]?.computedAt ??
          new Date();

        return { entries, currentUserEntry, totalCount, computedAt };
      }),

    getGlobal: protectedProcedure
      .input(
        z.object({
          limit: z.number().max(100).default(50),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(async ({ ctx, input }) => {
        const allRows = await leaderboardService.getGlobalLeaderboardAll();
        const rows = allRows.slice(input.offset, input.offset + input.limit);
        const totalCount = allRows.length;

        const userIds = rows.map((r) => r.userId);
        const profileByUserId = new Map<
          string,
          { username: string; targetRole: string }
        >();

        if (userIds.length > 0) {
          const profileRows = await ctx.db
            .select({
              userId: profiles.userId,
              username: profiles.username,
              targetRole: profiles.targetRole,
            })
            .from(profiles)
            .where(inArray(profiles.userId, userIds));

          for (const row of profileRows) {
            profileByUserId.set(row.userId, {
              username: row.username,
              targetRole: row.targetRole,
            });
          }
        }

        const entries = rows.map((row, index) => {
          const profile = profileByUserId.get(row.userId);
          return {
            ...row,
            rank: input.offset + index + 1,
            displayName: profile?.username ?? "Builder",
            targetRole: profile?.targetRole ?? "AI_GENERALIST",
            imageUrl: null as string | null,
          };
        });

        const viewerId = ctx.appUser.id;
        const viewerInList = entries.some((e) => e.userId === viewerId);
        let currentUserEntry: (typeof entries)[number] | null = null;

        if (!viewerInList) {
          const mine = allRows.find((r) => r.userId === viewerId);
          if (mine) {
            const [profile] = await ctx.db
              .select({
                username: profiles.username,
                targetRole: profiles.targetRole,
              })
              .from(profiles)
              .where(eq(profiles.userId, viewerId))
              .limit(1);

            const rank = allRows.findIndex((r) => r.userId === viewerId) + 1;

            currentUserEntry = {
              ...mine,
              rank: rank || allRows.length + 1,
              displayName: profile?.username ?? "You",
              targetRole: profile?.targetRole ?? "AI_GENERALIST",
              imageUrl: null,
            };
          }
        }

        const computedAt =
          entries[0]?.computedAt ??
          allRows[0]?.computedAt ??
          new Date();

        return { entries, currentUserEntry, totalCount, computedAt };
      }),
  }),
});
