import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AiReviewerData, ProjectEmbed } from "@/db/schema/projects";

export const PROJECT_EMBEDS_BUCKET = "project-embeds";

export const MAX_PUBLISHES_PER_24H = 5;
export const PUBLISH_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function titleToSlugBase(title: string): string {
  const s = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/gi, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s.length > 0 ? s : "project";
}

export function toEmbedJson(embed: ProjectEmbed) {
  const supabase = getSupabaseAdmin();
  let url = embed.url;
  if (embed.storageKey) {
    url = supabase.storage
      .from(PROJECT_EMBEDS_BUCKET)
      .getPublicUrl(embed.storageKey).data.publicUrl;
  }
  return {
    id: embed.id,
    type: embed.type,
    url,
    file_size_bytes: embed.fileSizeBytes ?? null,
    display_order: embed.displayOrder,
    created_at: embed.createdAt.toISOString(),
  };
}

/** Embed row has proof the reviewer can cite (link or uploaded file). */
export function projectEmbedHasEvidence(embed: {
  url: string | null;
  storageKey: string | null;
}): boolean {
  const u = embed.url?.trim();
  if (u) return true;
  const sk = embed.storageKey?.trim();
  return Boolean(sk);
}

export function sanitizeAiReviewerDataForClient(
  data: AiReviewerData | null
): Omit<AiReviewerData, "reasoning"> | null {
  if (!data) return null;
  const { reasoning: _reasoning, ...rest } = data;
  void _reasoning;
  return rest;
}

export function toProjectJson(p: {
  id: string;
  userId: string;
  username: string;
  slug: string;
  title: string;
  oneLiner: string;
  problemSolved: string;
  aiStack: string[];
  myRole: string;
  outcome: string;
  privacyMode: string;
  aiReviewerScore: number | null;
  aiReviewerData: AiReviewerData | null;
  autoTags: string[];
  templateId: string | null;
  isDeleted: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    user_id: p.userId,
    username: p.username,
    slug: p.slug,
    title: p.title,
    one_liner: p.oneLiner,
    problem_solved: p.problemSolved,
    ai_stack: p.aiStack,
    my_role: p.myRole,
    outcome: p.outcome,
    privacy_mode: p.privacyMode,
    ai_reviewer_score: p.aiReviewerScore,
    ai_reviewer_data: sanitizeAiReviewerDataForClient(p.aiReviewerData),
    auto_tags: p.autoTags,
    template_id: p.templateId,
    is_deleted: p.isDeleted,
    published_at: p.publishedAt?.toISOString() ?? null,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}
