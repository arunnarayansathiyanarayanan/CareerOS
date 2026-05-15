import { NextResponse } from "next/server";

import { getClerkAppSession } from "@/lib/auth";
import { ensureAppUserPublicUsername } from "@/lib/ensureAppUserPublicUsername";
import { getDb } from "@/db";
import { projects } from "@/db/schema/projects";
import { toProjectJson } from "@/lib/projectsApiShared";

export const runtime = "nodejs";

const DRAFT_PROBLEM =
  "Describe the business or user problem this project solves. Include who it helps, why it matters, and any constraints—aim for at least one hundred characters before you publish your project.";

function jsonErr(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/** Creates an unpublished project row so embeds, AI review, and PATCH auto-save work before publish. */
export async function POST() {
  try {
    const session = await getClerkAppSession();
    if (session.status === "signed_out") {
      return jsonErr(401, { error: "Authentication required", code: "UNAUTHORIZED" });
    }
    if (session.status === "missing_app_user") {
      return jsonErr(403, {
        error: "App user not found. Complete onboarding first.",
        code: "USER_NOT_PROVISIONED",
      });
    }
    const { appUser, clerkUserId } = session;

    const username = await ensureAppUserPublicUsername({
      appUserId: appUser.id,
      clerkUserId,
      username: appUser.username,
    });
    const slug = `draft-${crypto.randomUUID().replace(/-/g, "")}`;

    const db = getDb();
    const [project] = await db
      .insert(projects)
      .values({
        userId: appUser.id,
        username,
        slug,
        title: "Untitled project",
        oneLiner: "Add a one-line summary of your work.",
        problemSolved: DRAFT_PROBLEM,
        aiStack: [],
        myRole: "Your role on this project",
        outcome: "The measurable result or impact you delivered.",
        privacyMode: "unlisted",
        publishedAt: null,
      })
      .returning();

    if (!project) {
      return jsonErr(500, { error: "Create failed", code: "INTERNAL_ERROR" });
    }

    return NextResponse.json({ project: toProjectJson(project) });
  } catch (e) {
    console.error("[projects/draft POST]", e);
    return jsonErr(500, { error: "Unexpected server error", code: "INTERNAL_ERROR" });
  }
}
