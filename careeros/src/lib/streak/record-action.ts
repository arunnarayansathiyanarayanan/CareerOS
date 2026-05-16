import type { SupabaseClient } from "@supabase/supabase-js";

export type StreakAction =
  | "concept_completed"
  | "project_published"
  | "interview_completed"
  | "feed_post";

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Records a qualifying action for the UTC calendar day (idempotent per action).
 * Streak display reads `streak_actions` separately to compute consecutive days.
 */
export async function recordStreakAction(
  userId: string,
  action: StreakAction,
  supabase: SupabaseClient
): Promise<void> {
  const actionDate = todayUtcDateString();

  const { data: existing, error: selectError } = await supabase
    .from("streak_actions")
    .select("actions")
    .eq("user_id", userId)
    .eq("action_date", actionDate)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (!existing) {
    const { error: insertError } = await supabase.from("streak_actions").insert({
      user_id: userId,
      action_date: actionDate,
      actions: [action],
    });

    if (insertError?.code === "23505") {
      await appendStreakAction(userId, actionDate, action, supabase);
      return;
    }
    if (insertError) {
      throw new Error(insertError.message);
    }
    return;
  }

  await appendStreakAction(userId, actionDate, action, supabase, existing.actions);
}

async function appendStreakAction(
  userId: string,
  actionDate: string,
  action: StreakAction,
  supabase: SupabaseClient,
  existingActions?: unknown
): Promise<void> {
  const actions = Array.isArray(existingActions)
    ? (existingActions as string[])
    : [];

  if (actions.includes(action)) {
    return;
  }

  const { error: updateError } = await supabase
    .from("streak_actions")
    .update({
      actions: [...actions, action],
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("action_date", actionDate);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
