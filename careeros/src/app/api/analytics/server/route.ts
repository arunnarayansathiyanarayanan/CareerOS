import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { PostHog } from "posthog-node";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  event: z.string().min(1).max(128),
  properties: z.record(z.string(), z.unknown()).optional().default({}),
});

function getPostHogKey(): string | null {
  return (
    process.env.POSTHOG_API_KEY ??
    process.env.NEXT_PUBLIC_POSTHOG_KEY ??
    null
  );
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = getPostHogKey();
    if (!apiKey) {
      return new NextResponse(null, { status: 204 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { event, properties } = parsed.data;
    const host =
      process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

    const client = new PostHog(apiKey, {
      host,
      flushAt: 1,
      flushInterval: 0,
    });

    try {
      await client.captureImmediate({
        distinctId: userId,
        event,
        properties: {
          ...properties,
          source: "careeros_server_route",
        },
      });
    } finally {
      await client.shutdown();
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[analytics/server] POST:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
