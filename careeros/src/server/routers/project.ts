import { and, desc, eq, ilike, inArray, isNotNull, or } from "drizzle-orm";
import { z } from "zod";

import { projects } from "@/db/schema/projects";

import { protectedProcedure, router } from "../trpc";

export type ProjectListMineItem = {
  id: string;
  title: string;
  oneLiner: string;
  slug: string;
  publishedAt: string | null;
};

export type ProjectSearchItem = {
  id: string;
  title: string;
  slug: string;
  oneLiner: string;
};

export const projectRouter = router({
  /** Search the signed-in user's published projects by title or one-liner. */
  search: protectedProcedure
    .input(z.object({ q: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const term = `%${input.q.trim()}%`;
      const rows = await ctx.db
        .select({
          id: projects.id,
          title: projects.title,
          slug: projects.slug,
          oneLiner: projects.oneLiner,
        })
        .from(projects)
        .where(
          and(
            eq(projects.userId, ctx.appUser.id),
            eq(projects.isDeleted, false),
            isNotNull(projects.publishedAt),
            inArray(projects.privacyMode, ["public", "unlisted"]),
            or(ilike(projects.title, term), ilike(projects.oneLiner, term)),
          ),
        )
        .orderBy(desc(projects.publishedAt))
        .limit(8);

      return rows satisfies ProjectSearchItem[];
    }),

  /** Published public/unlisted projects for the signed-in owner (profile pin picker). */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: projects.id,
        title: projects.title,
        oneLiner: projects.oneLiner,
        slug: projects.slug,
        publishedAt: projects.publishedAt,
      })
      .from(projects)
      .where(
        and(
          eq(projects.userId, ctx.appUser.id),
          eq(projects.isDeleted, false),
          isNotNull(projects.publishedAt),
          inArray(projects.privacyMode, ["public", "unlisted"])
        )
      )
      .orderBy(desc(projects.publishedAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      oneLiner: r.oneLiner,
      slug: r.slug,
      publishedAt: r.publishedAt?.toISOString() ?? null,
    })) satisfies ProjectListMineItem[];
  }),
});
