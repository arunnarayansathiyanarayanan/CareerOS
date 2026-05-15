import { NextResponse } from "next/server";
import { z } from "zod";

import { profileViewSourceEnum } from "@/db/schema/profile";
import { createCaller } from "@/server/caller";
import { createTRPCContext } from "@/server/trpc";

const SOURCE_TUPLE = profileViewSourceEnum.enumValues as [
  string,
  ...string[],
];

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .transform((s) => s.toLowerCase()),
  source: z.enum(SOURCE_TUPLE).optional(),
  referrerUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ctx = await createTRPCContext({ headers: request.headers });
  const caller = createCaller(ctx);
  try {
    await caller.profile.recordView({
      username: parsed.data.username,
      source: parsed.data.source ?? "DIRECT",
      referrerUrl: parsed.data.referrerUrl,
    });
  } catch {
    /* best-effort telemetry */
  }

  return NextResponse.json({ ok: true as const });
}
