import { createId as cuid } from "@paralleldrive/cuid2";
import { and, eq, ne, sql } from "drizzle-orm";
import OpenAI from "openai";

import { projects } from "@/db/schema/projects";
import { db } from "@/server/db";
import {
  peerReviews,
  type PeerReviewRubricScores,
  reviewCredits,
} from "@/server/db/schema/community.schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PLACEHOLDER_RUBRIC: PeerReviewRubricScores = {
  relevance: 0,
  execution: 0,
  documentation: 0,
  impact: 0,
};

export class InsufficientCreditsError extends Error {
  statusCode = 402;
  constructor(msg = "Insufficient review credits") {
    super(msg);
  }
}

export class ValidationError extends Error {
  statusCode = 400;
  constructor(msg: string) {
    super(msg);
  }
}

function isRubricValid(scores: PeerReviewRubricScores): boolean {
  const values = [
    scores.relevance,
    scores.execution,
    scores.documentation,
    scores.impact,
  ];
  return values.every((v) => v >= 1 && v <= 10);
}

function averageRubricScore(scores: PeerReviewRubricScores): number {
  return (
    (scores.relevance +
      scores.execution +
      scores.documentation +
      scores.impact) /
    4
  );
}

function isUnassignedReview(
  review: typeof peerReviews.$inferSelect,
): boolean {
  const { rubricScores, overallScore } = review;
  return (
    overallScore === 0 &&
    rubricScores.relevance === 0 &&
    rubricScores.execution === 0 &&
    rubricScores.documentation === 0 &&
    rubricScores.impact === 0
  );
}

export async function requestPeerReview(
  userId: string,
  projectId: string,
): Promise<typeof peerReviews.$inferSelect> {
  return db.transaction(async (tx) => {
    const [credit] = await tx
      .select()
      .from(reviewCredits)
      .where(eq(reviewCredits.userId, userId));

    if (!credit || credit.balance < 1) {
      throw new InsufficientCreditsError();
    }

    const [existingPending] = await tx
      .select()
      .from(peerReviews)
      .where(
        and(
          eq(peerReviews.projectId, projectId),
          eq(peerReviews.status, "PENDING"),
        ),
      )
      .limit(1);

    if (existingPending) {
      throw new ValidationError("Review already pending");
    }

    const [project] = await tx
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new ValidationError("Project not found");
    }

    if (project.userId === userId) {
      throw new ValidationError("Cannot request review on your own project");
    }

    const [inserted] = await tx
      .insert(peerReviews)
      .values({
        id: cuid(),
        reviewerId: userId,
        projectId,
        rubricScores: PLACEHOLDER_RUBRIC,
        overallScore: 0,
        strengths: [],
        improvements: [],
        status: "PENDING",
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to create peer review request");
    }

    await tx
      .update(reviewCredits)
      .set({
        balance: sql`${reviewCredits.balance} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(reviewCredits.userId, userId));

    return inserted;
  });
}

export type SubmitPeerReviewInput = {
  rubricScores: PeerReviewRubricScores;
  strengths: string[];
  improvements: string[];
};

export async function submitPeerReview(
  reviewerId: string,
  reviewId: string,
  input: SubmitPeerReviewInput,
): Promise<typeof peerReviews.$inferSelect> {
  if (!isRubricValid(input.rubricScores)) {
    throw new ValidationError("Rubric scores must be between 1 and 10");
  }

  const overallScore = averageRubricScore(input.rubricScores);

  return db.transaction(async (tx) => {
    const [review] = await tx
      .select()
      .from(peerReviews)
      .where(eq(peerReviews.id, reviewId))
      .limit(1);

    if (!review) {
      throw new ValidationError("Review not found");
    }

    if (review.status !== "PENDING") {
      throw new ValidationError("Review is not pending");
    }

    const canSubmit =
      review.reviewerId === reviewerId || isUnassignedReview(review);
    if (!canSubmit) {
      throw new ValidationError("Not authorized to submit this review");
    }

    const [project] = await tx
      .select()
      .from(projects)
      .where(eq(projects.id, review.projectId))
      .limit(1);

    if (!project) {
      throw new ValidationError("Project not found");
    }

    if (project.userId === reviewerId) {
      throw new ValidationError("Cannot review your own project");
    }

    const [updated] = await tx
      .update(peerReviews)
      .set({
        reviewerId,
        rubricScores: input.rubricScores,
        overallScore,
        strengths: input.strengths,
        improvements: input.improvements,
        status: "COMPLETED",
        completedAt: new Date(),
      })
      .where(eq(peerReviews.id, reviewId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update peer review");
    }

    const [credit] = await tx
      .insert(reviewCredits)
      .values({
        id: cuid(),
        userId: reviewerId,
        balance: 0,
        reviewCountSinceLastGrant: 1,
      })
      .onConflictDoUpdate({
        target: reviewCredits.userId,
        set: {
          reviewCountSinceLastGrant: sql`${reviewCredits.reviewCountSinceLastGrant} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!credit) {
      throw new Error("Failed to update review credits");
    }

    if (credit.reviewCountSinceLastGrant >= 3) {
      await tx
        .update(reviewCredits)
        .set({
          balance: sql`${reviewCredits.balance} + 1`,
          reviewCountSinceLastGrant: 0,
          updatedAt: new Date(),
        })
        .where(eq(reviewCredits.userId, reviewerId));
    }

    return updated;
  });
}

export async function getAIReviewSuggestions(
  projectDescription: string,
  techStack: string[],
): Promise<{ strengths: string[]; improvements: string[] }> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You are a senior AI product reviewer at Aihired. Evaluate projects for AI-native professional portfolios. Return ONLY valid JSON: { "strengths": [string, string, string], "improvements": [string, string, string] }',
        },
        {
          role: "user",
          content: `Project: ${projectDescription}\nTech stack: ${techStack.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const content = res.choices[0]?.message?.content;
    if (!content) {
      return { strengths: [], improvements: [] };
    }

    const parsed = JSON.parse(content) as {
      strengths?: unknown;
      improvements?: unknown;
    };

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((s): s is string => typeof s === "string")
      : [];
    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements.filter((s): s is string => typeof s === "string")
      : [];

    return { strengths, improvements };
  } catch {
    return { strengths: [], improvements: [] };
  }
}

export async function getPendingReviewsForUser(
  userId: string,
): Promise<(typeof peerReviews.$inferSelect)[]> {
  return db
    .select()
    .from(peerReviews)
    .where(
      and(
        eq(peerReviews.status, "PENDING"),
        ne(peerReviews.reviewerId, userId),
      ),
    );
}
