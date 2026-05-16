import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export type SupabaseSession = {
  clerkId: string;
  userId: string;
  supabase: SupabaseClient;
};

function createSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Clerk session check + Supabase DB client scoped to the app `users` row.
 * Returns 401 when signed out, 403 when the app user is not provisioned.
 */
export async function requireSupabaseSession(): Promise<
  | { ok: true; session: SupabaseSession }
  | { ok: false; response: NextResponse }
> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  const supabase = createSupabaseServerClient();
  const { data: userRow, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) {
    console.error("[supabase/server] users lookup:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to resolve user", code: "DATABASE_ERROR" },
        { status: 502 }
      ),
    };
  }

  if (!userRow?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "App user not found. Complete onboarding first.",
          code: "USER_NOT_PROVISIONED",
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    session: {
      clerkId,
      userId: userRow.id as string,
      supabase,
    },
  };
}
