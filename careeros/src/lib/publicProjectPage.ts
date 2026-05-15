import { cache } from "react";
import { and, asc, desc, eq, gt } from "drizzle-orm";

import { getDb } from "@/db";
import {
  projectEmbeds,
  projects,
  recruiterShareTokens,
  type Project,
  type ProjectEmbed,
} from "@/db/schema/projects";
import { getClerkAppSession } from "@/lib/auth";

/** OG images & open graph: only `privacy_mode = public` projects (no session). */
export const loadPublicProjectPage = cache(
  async (username: string, slug: string): Promise<Project | null> => {
    const db = getDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.username, username),
          eq(projects.slug, slug),
          eq(projects.isDeleted, false),
          eq(projects.privacyMode, "public")
        )
      )
      .limit(1);
    return project ?? null;
  }
);

export type PublicProjectAccess =
  | { status: "not_found" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "redirect_recruiter"; token: string }
  | { status: "ok"; project: Project };

async function findActiveRecruiterToken(projectId: string): Promise<string | null> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({ token: recruiterShareTokens.token })
    .from(recruiterShareTokens)
    .where(
      and(
        eq(recruiterShareTokens.projectId, projectId),
        eq(recruiterShareTokens.isRevoked, false),
        gt(recruiterShareTokens.expiresAt, now)
      )
    )
    .orderBy(desc(recruiterShareTokens.createdAt))
    .limit(1);
  return row?.token ?? null;
}

/**
 * Authoritative access gate for `/p/:username/:slug` (server components + metadata).
 */
export const resolvePublicProjectAccess = cache(
  async (username: string, slug: string): Promise<PublicProjectAccess> => {
    const db = getDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.username, username),
          eq(projects.slug, slug),
          eq(projects.isDeleted, false)
        )
      )
      .limit(1);

    if (!project) {
      return { status: "not_found" };
    }

    const session = await getClerkAppSession();
    const sessionUserId =
      session.status === "authenticated" ? session.appUser.id : undefined;
    const isOwner = sessionUserId !== undefined && sessionUserId === project.userId;

    if (project.privacyMode === "public") {
      return { status: "ok", project };
    }

    if (project.privacyMode === "unlisted") {
      if (session.status !== "authenticated") {
        return { status: "unauthorized" };
      }
      if (!isOwner) {
        return { status: "forbidden" };
      }
      return { status: "ok", project };
    }

    // recruiter_share
    if (isOwner) {
      return { status: "ok", project };
    }
    const token = await findActiveRecruiterToken(project.id);
    if (!token) {
      return { status: "not_found" };
    }
    return { status: "redirect_recruiter", token };
  }
);

export const loadPublicProjectEmbeds = cache(
  async (projectId: string): Promise<ProjectEmbed[]> => {
    const db = getDb();
    return db
      .select()
      .from(projectEmbeds)
      .where(eq(projectEmbeds.projectId, projectId))
      .orderBy(asc(projectEmbeds.displayOrder), asc(projectEmbeds.createdAt));
  }
);
