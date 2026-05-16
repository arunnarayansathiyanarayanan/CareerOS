import { createHash } from "node:crypto";

import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";

import { SKILL_ONTOLOGY } from "@/constants/skill-ontology";
import {
  endorsements,
  profiles,
  profileViewSourceEnum,
  profileVisibilityEnum,
  profileViews,
  skillGraphEntries,
} from "@/db/schema/profile";
import { projects } from "@/db/schema/projects";
import { users } from "@/db/schema/users";
import { getClerkAppSession } from "@/lib/auth";
import { tryAcquireProfileViewDedupSlot } from "@/lib/redis-profile-views";
import { updateProfileInputSchema } from "@/lib/validators/profile";
import { loadPublicInterviewReadiness } from "@/lib/interviews/public-profile-readiness";
import {
  maybeAutoPinFirstPublishedProject,
  reconcileProfileSkillGraphFromPublishedProjects,
} from "@/services/syncProfileSkillGraph";

import { protectedProcedure, publicProcedure, router } from "../trpc";

const PROFILE_VIEW_DEDUP_TTL_SEC = 600;

const SKILL_ONTOLOGY_TUPLE = SKILL_ONTOLOGY as unknown as [string, ...string[]];

type ProfileVisibilityValue =
  (typeof profileVisibilityEnum.enumValues)[number];

/** Matches `public.profile_view_source`. */
export type ViewSource =
  (typeof profileViewSourceEnum.enumValues)[number];

const PROFILE_VIEW_SOURCE_TUPLE =
  profileViewSourceEnum.enumValues as unknown as [string, ...string[]];

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .transform((s) => s.toLowerCase())
  .pipe(
    z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/,
        "Username must match profile username rules."
      )
  );

const viewSourceSchema = z.enum(PROFILE_VIEW_SOURCE_TUPLE);

const SKILL_SOURCE_WEIGHT: Record<string, number> = {
  ENDORSEMENT: 3,
  PROJECT_TAG: 2,
  DECLARED: 1,
};

/** Minimal pinned project summary for profile pages. */
export type ProfilePinnedProjectDTO = {
  id: string;
  slug: string;
  title: string;
  oneLiner: string;
  username: string;
  publishedAt: string | null;
  aiStack: string[];
  /** Reserved for future project-level analytics; currently always 0. */
  viewCount: number;
};

export type ProfileSkillGraphEntryDTO = {
  skill: string;
  source: "DECLARED" | "PROJECT_TAG" | "ENDORSEMENT";
  proficiency: number | null;
};

export type ProfileInterviewReadinessDTO = {
  scores: {
    track: string;
    score: number;
    session_count: number;
    avg_overall_score: number;
  }[];
};

/**
 * Public-safe payload for `[username]` profile pages (`headline`, skills, pinned work, streak).
 */
export type ProfilePublicDTO = {
  userId: string;
  username: string;
  displayName: string;
  headline: string | null;
  targetRole: string;
  availabilityStatus: string;
  visibility: ProfileVisibilityValue;
  /** Omitted for non-owners (PII). */
  location: string | null;
  customDomain: string | null;
  imageUrl: string | null;
  aiNativeVerified: boolean;
  verifiedAt: string | null;
  streakDays: number;
  roadmapProgressPct: number;
  pinnedProjects: ProfilePinnedProjectDTO[];
  skillGraphTop: ProfileSkillGraphEntryDTO[];
  /** Present when the owner opted in and has ≥3 completed interviews. */
  interviewReadiness: ProfileInterviewReadinessDTO | null;
  interviewReadinessPublic: boolean;
  viewerIsOwner: boolean;
};

function getClientIp(headers: Headers | null): string {
  if (!headers) return "unknown";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return headers.get("x-real-ip")?.trim() ?? "unknown";
}

function hashIp(ip: string): string {
  const pepper = process.env.PROFILE_VIEW_IP_PEPPER ?? "";
  return createHash("sha256").update(`${pepper}${ip}`).digest("hex");
}

async function resolveViewerUserId(): Promise<string | undefined> {
  const session = await getClerkAppSession();
  if (session.status === "authenticated") return session.appUser.id;
  return undefined;
}

function viewerScopeKey(viewerUserId: string | undefined): string {
  return viewerUserId ?? "signed-out";
}

/** Shared access rules for public profile sub-resources. */
function assertProfileReadableForViewer(
  profileRow: {
    userId: string;
    visibility: ProfileVisibilityValue;
  },
  viewerUserId: string | undefined
): boolean {
  if (profileRow.visibility === "ANONYMOUS") return false;
  if (profileRow.visibility === "PRIVATE") {
    if (!viewerUserId || viewerUserId !== profileRow.userId) return false;
  }
  return true;
}

async function loadProfilePublicBundle(
  username: string,
  viewerScope: string
): Promise<ProfilePublicDTO | null> {
  const viewerUserId =
    viewerScope === "signed-out" ? undefined : viewerScope;

  const { getDb } = await import("@/db");
  const db = getDb();

  const [prof] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);

  if (!prof) return null;
  if (!assertProfileReadableForViewer(prof, viewerUserId)) return null;

  const viewerIsOwner =
    viewerUserId !== undefined && viewerUserId === prof.userId;

  const [userRow] = await db
    .select({ clerkId: users.clerkId })
    .from(users)
    .where(eq(users.id, prof.userId))
    .limit(1);

  let displayName = prof.username;
  let imageUrl: string | null = null;
  if (userRow?.clerkId) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const c = await clerkClient();
      const cu = await c.users.getUser(userRow.clerkId);
      const full = [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim();
      const fromMail =
        cu.primaryEmailAddress?.emailAddress?.split("@")[0]?.trim() ?? "";
      displayName =
        full ||
        (cu.username ? String(cu.username) : null) ||
        (fromMail.length >= 2 ? fromMail : null) ||
        prof.username;
      imageUrl = cu.imageUrl?.length ? cu.imageUrl : null;
    } catch {
      /* Clerk unavailable (e.g. build workers); fall back to username */
    }
  }

  let pinnedIds = prof.pinnedProjectIds ?? [];
  let pinnedProjects: ProfilePinnedProjectDTO[] = [];

  if (pinnedIds.length === 0) {
    const [firstPublished] = await db
      .select({
        id: projects.id,
        privacyMode: projects.privacyMode,
      })
      .from(projects)
      .where(
        and(
          eq(projects.userId, prof.userId),
          eq(projects.isDeleted, false),
          isNotNull(projects.publishedAt),
          inArray(projects.privacyMode, ["public", "unlisted"])
        )
      )
      .orderBy(desc(projects.publishedAt))
      .limit(1);

    if (firstPublished) {
      await maybeAutoPinFirstPublishedProject(
        prof.userId,
        firstPublished.id,
        firstPublished.privacyMode
      );
      const [refreshed] = await db
        .select({ pinnedProjectIds: profiles.pinnedProjectIds })
        .from(profiles)
        .where(eq(profiles.id, prof.id))
        .limit(1);
      pinnedIds = refreshed?.pinnedProjectIds ?? [];
    }
  }

  if (pinnedIds.length > 0) {
    const rows = await db
      .select({
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
        oneLiner: projects.oneLiner,
        username: projects.username,
        publishedAt: projects.publishedAt,
        aiStack: projects.aiStack,
      })
      .from(projects)
      .where(
        and(
          inArray(projects.id, pinnedIds),
          eq(projects.userId, prof.userId),
          eq(projects.isDeleted, false),
          isNotNull(projects.publishedAt),
          inArray(projects.privacyMode, ["public", "unlisted"])
        )
      );

    const rank = new Map(pinnedIds.map((id, i) => [id, i]));
    rows.sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
    pinnedProjects = rows.slice(0, 5).map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      oneLiner: r.oneLiner,
      username: r.username,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      aiStack: r.aiStack ?? [],
      viewCount: 0,
    }));
  }

  let graphRows = await db
    .select({
      skill: skillGraphEntries.skill,
      source: skillGraphEntries.source,
      proficiency: skillGraphEntries.proficiency,
    })
    .from(skillGraphEntries)
    .where(eq(skillGraphEntries.profileId, prof.id));

  if (graphRows.length === 0) {
    await reconcileProfileSkillGraphFromPublishedProjects(prof.userId);
    graphRows = await db
      .select({
        skill: skillGraphEntries.skill,
        source: skillGraphEntries.source,
        proficiency: skillGraphEntries.proficiency,
      })
      .from(skillGraphEntries)
      .where(eq(skillGraphEntries.profileId, prof.id));
  }

  graphRows.sort((a, b) => {
    const wa = SKILL_SOURCE_WEIGHT[a.source] ?? 0;
    const wb = SKILL_SOURCE_WEIGHT[b.source] ?? 0;
    if (wb !== wa) return wb - wa;
    const pa = a.proficiency ?? 0;
    const pb = b.proficiency ?? 0;
    if (pb !== pa) return pb - pa;
    return a.skill.localeCompare(b.skill);
  });

  const skillGraphTop: ProfileSkillGraphEntryDTO[] = graphRows
    .slice(0, 12)
    .map((r) => ({
      skill: r.skill,
      source: r.source,
      proficiency: r.proficiency,
    }));

  const readinessScores = await loadPublicInterviewReadiness(
    db,
    prof.userId,
    prof.interviewReadinessPublic
  );

  return {
    userId: prof.userId,
    username: prof.username,
    displayName,
    headline: prof.headline,
    targetRole: prof.targetRole,
    availabilityStatus: prof.availabilityStatus,
    visibility: prof.visibility,
    location: viewerIsOwner ? prof.location : null,
    customDomain: prof.customDomain,
    imageUrl,
    aiNativeVerified: prof.aiNativeVerified,
    verifiedAt: prof.verifiedAt?.toISOString() ?? null,
    streakDays: prof.streakDays,
    roadmapProgressPct: prof.roadmapProgressPct,
    pinnedProjects,
    skillGraphTop,
    interviewReadiness:
      readinessScores && readinessScores.length > 0
        ? { scores: readinessScores }
        : null,
    interviewReadinessPublic: prof.interviewReadinessPublic,
    viewerIsOwner,
  };
}

function getCachedProfileByUsername(username: string, viewerKey: string) {
  return unstable_cache(
    async () => loadProfilePublicBundle(username, viewerKey),
    ["careeros-profile-e4", username, viewerKey],
    { revalidate: 60, tags: [`profile:${username}`] }
  );
}

async function assertCronOrOwner(
  headers: Headers | null,
  userId: string
): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  const header = headers?.get("x-careeros-cron-secret")?.trim();
  if (secret && header === secret) return;

  const session = await getClerkAppSession();
  if (session.status === "authenticated" && session.appUser.id === userId) {
    return;
  }

  throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed." });
}

/** Build-time helper: pre-render the most-viewed public profiles (SSG seed list). */
export async function getTopPublicProfileUsernamesByViews(
  limit: number
): Promise<{ username: string }[]> {
  try {
    const { getDb } = await import("@/db");
    const db = getDb();
    return await db
      .select({
        username: profiles.username,
      })
      .from(profiles)
      .leftJoin(profileViews, eq(profileViews.profileId, profiles.id))
      .where(eq(profiles.visibility, "PUBLIC"))
      .groupBy(profiles.id)
      .orderBy(desc(sql<number>`count(${profileViews.id})::int`))
      .limit(limit);
  } catch {
    return [];
  }
}

export const profileRouter = router({
  /**
   * Load a public profile bundle (pinned projects, skill graph, streak, roadmap progress)
   * with a 60s data cache. Anonymous profiles behave as missing; private profiles are only
   * visible to the owner.
   */
  getByUsername: publicProcedure
    .input(z.object({ username: usernameSchema }))
    .query(async ({ input }) => {
      const viewerUserId = await resolveViewerUserId();
      const scope = viewerScopeKey(viewerUserId);
      const cached = getCachedProfileByUsername(input.username, scope);
      const data = await cached();
      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      }
      return data;
    }),

  /**
   * Update editable profile fields for the signed-in owner. Validates pinned UUIDs against
   * that user’s published `public` / `unlisted` projects and revalidates the profile tag.
   */
  updateProfile: protectedProcedure
    .input(updateProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      const me = ctx.appUser;

      const [prof] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, me.id))
        .limit(1);

      if (!prof) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      }

      if (input.pinnedProjectIds !== undefined) {
        if (input.pinnedProjectIds.length > 0) {
          const valid = await db
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                inArray(projects.id, input.pinnedProjectIds),
                eq(projects.userId, me.id),
                eq(projects.isDeleted, false),
                isNotNull(projects.publishedAt),
                inArray(projects.privacyMode, ["public", "unlisted"])
              )
            );

          if (valid.length !== input.pinnedProjectIds.length) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Each pinned project must be yours, published, and public or unlisted.",
            });
          }
        }
      }

      const [updated] = await db
        .update(profiles)
        .set({
          ...(input.headline !== undefined ? { headline: input.headline } : {}),
          ...(input.availabilityStatus !== undefined
            ? { availabilityStatus: input.availabilityStatus }
            : {}),
          ...(input.visibility !== undefined
            ? { visibility: input.visibility }
            : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.pinnedProjectIds !== undefined
            ? { pinnedProjectIds: input.pinnedProjectIds }
            : {}),
          ...(input.interviewReadinessPublic !== undefined
            ? { interviewReadinessPublic: input.interviewReadinessPublic }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, me.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      }

      revalidateTag(`profile:${updated.username.toLowerCase()}`);
      return updated;
    }),

  /**
   * Best-effort profile view telemetry with Redis-backed IP dedupe (10 minutes). Errors are
   * swallowed so clients never fail when tracking is unavailable.
   */
  recordView: publicProcedure
    .input(
      z.object({
        username: usernameSchema,
        source: viewSourceSchema,
        referrerUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = ctx.db;
        const [prof] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.username, input.username))
          .limit(1);

        if (!prof) return { ok: true as const };

        const viewerUserId = await resolveViewerUserId();
        if (!assertProfileReadableForViewer(prof, viewerUserId)) {
          return { ok: true as const };
        }

        const ipHash = hashIp(getClientIp(ctx.headers));
        const shouldWrite = await tryAcquireProfileViewDedupSlot(
          prof.id,
          ipHash,
          PROFILE_VIEW_DEDUP_TTL_SEC
        );
        if (!shouldWrite) return { ok: true as const };

        const viewerId =
          viewerUserId !== undefined ? viewerUserId : null;

        await db.insert(profileViews).values({
          profileId: prof.id,
          viewerId,
          source: input.source,
          referrerUrl: input.referrerUrl ?? null,
          ipHash,
        });
      } catch {
        /* fire-and-forget */
      }
      return { ok: true as const };
    }),

  /**
   * Owner-only analytics: views in the last 30 days, breakdown by `ViewSource`, and the
   * most recent view events (anonymous rows show as “Someone from LinkedIn”).
   */
  getViewStats: protectedProcedure.query(async ({ ctx }) => {
    const db = ctx.db;
    const me = ctx.appUser;

    const [prof] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, me.id))
      .limit(1);

    if (!prof) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Profile not found.",
      });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(profileViews)
      .where(
        and(
          eq(profileViews.profileId, prof.id),
          gte(profileViews.viewedAt, since)
        )
      );

    const bySourceRows = await db
      .select({
        source: profileViews.source,
        c: sql<number>`count(*)::int`,
      })
      .from(profileViews)
      .where(
        and(
          eq(profileViews.profileId, prof.id),
          gte(profileViews.viewedAt, since)
        )
      )
      .groupBy(profileViews.source);

    const recent = await db
      .select({
        viewedAt: profileViews.viewedAt,
        source: profileViews.source,
        viewerId: profileViews.viewerId,
        email: users.email,
      })
      .from(profileViews)
      .leftJoin(users, eq(profileViews.viewerId, users.id))
      .where(eq(profileViews.profileId, prof.id))
      .orderBy(desc(profileViews.viewedAt))
      .limit(10);

    return {
      totalLast30Days: totalRow?.c ?? 0,
      bySource: Object.fromEntries(
        bySourceRows.map((r) => [r.source, r.c])
      ) as Record<string, number>,
      lastViewers: recent.map((r) => ({
        viewedAt: r.viewedAt.toISOString(),
        source: r.source,
        label:
          r.viewerId && r.email
            ? r.email
            : "Someone from LinkedIn",
      })),
    };
  }),

  /**
   * Top skills on a profile by endorsement count (public, subject to the same visibility
   * rules as `getByUsername`).
   */
  getEndorsements: publicProcedure
    .input(z.object({ username: usernameSchema }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      const viewerUserId = await resolveViewerUserId();

      const [prof] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.username, input.username))
        .limit(1);

      if (!prof) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      }

      if (!assertProfileReadableForViewer(prof, viewerUserId)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      }

      const rows = await db
        .select({
          skill: endorsements.skill,
          c: count(endorsements.id),
        })
        .from(endorsements)
        .where(eq(endorsements.toProfileId, prof.id))
        .groupBy(endorsements.skill)
        .orderBy(desc(count(endorsements.id)))
        .limit(10);

      return rows.map((r) => ({
        skill: r.skill,
        count: Number(r.c),
      }));
    }),

  /**
   * Add a single skill endorsement; skills must exist in `SKILL_ONTOLOGY`, and duplicates
   * or self-endorsements are rejected.
   */
  addEndorsement: protectedProcedure
    .input(
      z.object({
        username: usernameSchema,
        skill: z.enum(SKILL_ONTOLOGY_TUPLE),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      const me = ctx.appUser;

      const [prof] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.username, input.username))
        .limit(1);

      if (!prof) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      }

      if (!assertProfileReadableForViewer(prof, me.id)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      }

      if (prof.userId === me.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot endorse your own profile.",
        });
      }

      try {
        await db.insert(endorsements).values({
          fromUserId: me.id,
          toProfileId: prof.id,
          skill: input.skill,
        });
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You already endorsed this skill on this profile.",
          });
        }
        throw e;
      }

      return { ok: true as const };
    }),

  /**
   * Internal eligibility check for the “AI-native verified” badge. Idempotent: sets
   * `ai_native_verified` when the user has enough high-scoring published work and streak.
   * Callable with `CRON_SECRET` or by the subject user (e.g. on profile load).
   */
  checkVerifiedStatus: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCronOrOwner(ctx.headers, input.userId);

      const db = ctx.db;

      const [prof] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, input.userId))
        .limit(1);

      if (!prof) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      }

      if (prof.aiNativeVerified) {
        return { updated: false as const, aiNativeVerified: true };
      }

      const [qualityRow] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(projects)
        .where(
          and(
            eq(projects.userId, input.userId),
            eq(projects.isDeleted, false),
            isNotNull(projects.publishedAt),
            inArray(projects.privacyMode, ["public", "unlisted"]),
            isNotNull(projects.aiReviewerScore),
            gte(projects.aiReviewerScore, 5)
          )
        );

      const qualityCount = qualityRow?.c ?? 0;
      const streakOk = prof.streakDays >= 30;
      const eligible = qualityCount >= 5 && streakOk;

      if (!eligible) {
        return { updated: false as const, aiNativeVerified: false };
      }

      await db
        .update(profiles)
        .set({
          aiNativeVerified: true,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, prof.id));

      return { updated: true as const, aiNativeVerified: true };
    }),
});
