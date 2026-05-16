import type { SupabaseClient } from "@supabase/supabase-js";

import type { InterviewProject } from "@/lib/ai/question-bank";

type ProjectRow = {
  id: string;
  title: string;
  ai_stack: string[] | null;
  outcome: string;
  problem_solved: string;
  one_liner: string;
};

export async function fetchInterviewProjects(
  supabase: SupabaseClient,
  userId: string,
  projectIds: string[] | null | undefined
): Promise<InterviewProject[]> {
  if (!projectIds || projectIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, title, ai_stack, outcome, problem_solved, one_liner")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .in("id", projectIds);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ProjectRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));

  return projectIds
    .map((id) => byId.get(id))
    .filter((row): row is ProjectRow => row !== undefined)
    .map((row) => ({
      name: row.title,
      stack: Array.isArray(row.ai_stack) ? row.ai_stack : [],
      outcome: row.outcome,
      description: row.problem_solved || row.one_liner,
    }));
}

export async function validateProjectContextIds(
  supabase: SupabaseClient,
  userId: string,
  projectContextIds: string[] | undefined
): Promise<{ ok: true; ids: string[] } | { ok: false; invalid: string[] }> {
  if (!projectContextIds || projectContextIds.length === 0) {
    return { ok: true, ids: [] };
  }

  const unique = [...new Set(projectContextIds)];
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .in("id", unique);

  if (error) {
    throw new Error(error.message);
  }

  const found = new Set((data ?? []).map((row) => (row as { id: string }).id));
  const invalid = unique.filter((id) => !found.has(id));
  if (invalid.length > 0) {
    return { ok: false, invalid };
  }

  return { ok: true, ids: unique };
}
