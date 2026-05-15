import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { onboardingProfiles } from "@/db/schema/onboarding";
import {
  roadmapItems,
  roadmapTargetRoleEnum,
  roadmaps,
} from "@/db/schema/roadmap";
import { users } from "@/db/schema/users";
import { calculateAiNativeReadyScore } from "@/lib/calculateAiNativeReadyScore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateAndPersistRoadmap } from "@/services/generateAndPersistRoadmap";
import { generateRoadmap } from "@/services/generateRoadmap";
import {
  RoadmapGenerationError,
  type RoadmapGenerationResult,
  type RoadmapItem,
  type TargetRole,
} from "@/types/roadmap";

export const runtime = "nodejs";

const generateBodySchema = z.object({
  targetRole: z.enum(
    roadmapTargetRoleEnum.enumValues as [TargetRole, ...TargetRole[]]
  ),
});

type GeneratedItem =
  RoadmapGenerationResult["phases"][number]["items"][number];

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function jsonError(
  status: number,
  body: Record<string, unknown>,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json(body, { status, headers });
}

function resumeSkills(resumeParsed: unknown): string[] | undefined {
  if (resumeParsed === null || resumeParsed === undefined) return undefined;
  if (typeof resumeParsed !== "object" || Array.isArray(resumeParsed)) {
    return undefined;
  }
  const skills = (resumeParsed as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return undefined;
  return skills.filter((s): s is string => typeof s === "string" && s.length > 0);
}

function generatedItemToInsert(
  roadmapId: string,
  item: GeneratedItem
): typeof roadmapItems.$inferInsert {
  return {
    roadmapId,
    type: item.type,
    phase: item.phase,
    phaseOrder: item.phaseOrder,
    itemOrder: item.itemOrder,
    title: item.title,
    description: item.description,
    estimatedHours: item.estimatedHours,
    difficulty: item.difficulty,
    dependencies: item.dependencies,
    status: item.status,
    userNote: item.userNote,
    externalLinks: item.externalLinks,
    proofOfWorkUrl: item.proofOfWorkUrl,
    techStack: item.techStack,
    completionChecklist: item.completionChecklist,
    completedAt: item.completedAt,
  };
}

function flattenGeneratedItems(
  generated: RoadmapGenerationResult
): GeneratedItem[] {
  return generated.phases.flatMap((phase) => phase.items);
}

function mapGenerationError(error: unknown): NextResponse | null {
  if (!(error instanceof RoadmapGenerationError)) return null;
  switch (error.code) {
    case "TIMEOUT":
      return jsonError(504, {
        error: "Roadmap generation timed out",
        code: "TIMEOUT",
      });
    case "QUOTA":
      return jsonError(
        503,
        {
          error: "Roadmap generation quota exceeded",
          code: "QUOTA",
        },
        { "Retry-After": "60" }
      );
    case "PARSE_FAIL":
      return jsonError(500, {
        error: "Failed to parse generated roadmap",
        code: "PARSE_FAIL",
      });
    default:
      return null;
  }
}

async function postViaSupabase(
  clerkId: string,
  targetRole: TargetRole
): Promise<NextResponse> {
  const supabase = getSupabaseAdmin();

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (userError || !userRow || typeof userRow.id !== "string") {
    return jsonError(422, {
      error: "User record not found. Complete onboarding first.",
      code: "USER_NOT_FOUND",
    });
  }

  const { data: activeRoadmap } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", userRow.id)
    .eq("status", "active")
    .maybeSingle();

  if (activeRoadmap?.id) {
    return jsonError(409, { roadmapId: activeRoadmap.id });
  }

  const { data: profile, error: profileError } = await supabase
    .from("onboarding_profiles")
    .select(
      "current_role, years_of_experience, ai_fluency, resume_parsed"
    )
    .eq("user_id", userRow.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonError(422, {
      error: "Onboarding profile not found",
      code: "PROFILE_NOT_FOUND",
    });
  }

  const skills = resumeSkills(profile.resume_parsed);

  try {
    const result = await generateAndPersistRoadmap({
      userId: userRow.id,
      targetRole,
      currentRole:
        typeof profile.current_role === "string" && profile.current_role.trim()
          ? profile.current_role.trim()
          : "Not specified",
      yearsExperience:
        typeof profile.years_of_experience === "string" &&
        profile.years_of_experience.trim()
          ? profile.years_of_experience.trim()
          : "Not specified",
      aiFluency:
        typeof profile.ai_fluency === "string" && profile.ai_fluency.trim()
          ? profile.ai_fluency.trim()
          : "not_started",
      ...(skills?.length ? { existingSkills: skills } : {}),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const mapped = mapGenerationError(error);
    if (mapped) return mapped;
    throw error;
  }
}

async function postViaDrizzle(
  clerkId: string,
  targetRole: TargetRole
): Promise<NextResponse> {
  const db = getDb();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return jsonError(422, {
      error: "User record not found. Complete onboarding first.",
      code: "USER_NOT_FOUND",
    });
  }

  const [activeRoadmap] = await db
    .select({ id: roadmaps.id })
    .from(roadmaps)
    .where(and(eq(roadmaps.userId, user.id), eq(roadmaps.status, "active")))
    .limit(1);

  if (activeRoadmap) {
    return jsonError(409, { roadmapId: activeRoadmap.id });
  }

  const [profile] = await db
    .select({
      currentRole: onboardingProfiles.currentRole,
      yearsOfExperience: onboardingProfiles.yearsOfExperience,
      aiFluency: onboardingProfiles.aiFluency,
      resumeParsed: onboardingProfiles.resumeParsed,
    })
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, user.id))
    .orderBy(desc(onboardingProfiles.createdAt))
    .limit(1);

  if (!profile) {
    return jsonError(422, {
      error: "Onboarding profile not found",
      code: "PROFILE_NOT_FOUND",
    });
  }

  const skills = resumeSkills(profile.resumeParsed);

  let generated: RoadmapGenerationResult;
  try {
    generated = await generateRoadmap({
      userId: user.id,
      targetRole,
      currentRole: profile.currentRole?.trim() || "Not specified",
      yearsExperience:
        profile.yearsOfExperience?.trim() || "Not specified",
      aiFluency: profile.aiFluency?.trim() || "not_started",
      ...(skills?.length ? { existingSkills: skills } : {}),
    });
  } catch (error) {
    const mapped = mapGenerationError(error);
    if (mapped) return mapped;
    throw error;
  }

  const flatItems = flattenGeneratedItems(generated);
  const aiNativeReadyScore = calculateAiNativeReadyScore(
    flatItems as RoadmapItem[]
  );
  const phaseCount = generated.phases.length;
  const totalItems = flatItems.length;

  const { roadmapId } = await db.transaction(async (tx) => {
    const [roadmap] = await tx
      .insert(roadmaps)
      .values({
        userId: user.id,
        targetRole,
        aiNativeReadyScore,
        status: "active",
      })
      .returning({ id: roadmaps.id });

    if (!roadmap) {
      throw new Error("Roadmap insert returned no row");
    }

    for (const phase of generated.phases) {
      for (const item of phase.items) {
        await tx
          .insert(roadmapItems)
          .values(generatedItemToInsert(roadmap.id, item));
      }
    }

    return { roadmapId: roadmap.id };
  });

  return NextResponse.json(
    {
      roadmapId,
      aiNativeReadyScore,
      phaseCount,
      totalItems,
    },
    { status: 201 }
  );
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return jsonError(401, {
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
    }

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return jsonError(400, {
        error: "Invalid JSON body",
        code: "INVALID_JSON",
      });
    }

    const parsed = generateBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return jsonError(400, {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    if (hasDatabaseUrl()) {
      return postViaDrizzle(clerkId, parsed.data.targetRole);
    }

    return postViaSupabase(clerkId, parsed.data.targetRole);
  } catch (error) {
    console.error("[roadmap/generate] unexpected:", error);
    return jsonError(500, {
      error: "Unexpected server error",
      code: "INTERNAL_ERROR",
    });
  }
}
