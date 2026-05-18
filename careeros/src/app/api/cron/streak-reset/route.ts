import { checkAndResetExpiredStreaks } from "@/server/services/streak.service";
import { guardCron } from "@/lib/cronGuard";

export const runtime = "nodejs";

// Vercel cron: "35 18 * * *" (18:35 UTC = 00:05 IST next day)
export async function POST(req: Request) {
  try {
    guardCron(req);
    const count = await checkAndResetExpiredStreaks();
    return Response.json({ reset: count });
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
