import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { projects } from "@/db/schema/projects";

import { protectedProcedure, router } from "../trpc";

export type ProjectListMineItem = {
  id: string;
  title: string;
  oneLiner: string;
  slug: string;
  publishedAt: string | null;
};

export const projectRouter = router({
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
