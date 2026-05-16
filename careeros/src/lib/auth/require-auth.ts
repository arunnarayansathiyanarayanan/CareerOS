import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseSession } from "@/lib/supabase/server";

export type AuthContext = {
  userId: string;
  supabase: SupabaseClient;
};

/**
 * Resolves Clerk session → app `users.id` and a Supabase service client.
 * @throws {Response} 401 when signed out, 403 when user is not provisioned, 502 on lookup failure.
 */
export async function requireAuth(_request: Request): Promise<AuthContext> {
  const result = await requireSupabaseSession();
  if (!result.ok) {
    throw result.response;
  }

  return {
    userId: result.session.userId,
    supabase: result.session.supabase,
  };
}

/** Converts a thrown `Response` from {@link requireAuth} into a route return value. */
export function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null;
}
