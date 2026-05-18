import { guardCron } from "@/lib/cronGuard";
import {
  dispatchSkillIntelligenceCronJob,
  type SkillIntelligenceCronJob,
} from "@/workers/cron";

export const runtime = "nodejs";

const VALID_JOBS = new Set<SkillIntelligenceCronJob>([
  "scrape",
  "aggregate",
  "email",
]);

function parseJobFromUrl(req: Request): SkillIntelligenceCronJob | null {
  const job = new URL(req.url).searchParams.get("job");
  if (job && VALID_JOBS.has(job as SkillIntelligenceCronJob)) {
    return job as SkillIntelligenceCronJob;
  }
  return null;
}

async function parseJobFromBody(
  req: Request,
): Promise<SkillIntelligenceCronJob | null> {
  try {
    const body = (await req.json()) as { job?: string };
    if (body.job && VALID_JOBS.has(body.job as SkillIntelligenceCronJob)) {
      return body.job as SkillIntelligenceCronJob;
    }
  } catch {
    // empty or invalid JSON body
  }
  return null;
}

async function handleCron(req: Request): Promise<Response> {
  const job =
    req.method === "GET"
      ? parseJobFromUrl(req)
      : ((await parseJobFromBody(req)) ?? parseJobFromUrl(req));

  if (!job) {
    return Response.json(
      { error: "Invalid job; expected scrape | aggregate | email" },
      { status: 400 },
    );
  }

  const start = Date.now();
  const result = await dispatchSkillIntelligenceCronJob(job);

  return Response.json({
    job,
    status: result.status,
    durationMs: Date.now() - start,
    ...(result.detail !== undefined ? { detail: result.detail } : {}),
  });
}

// Vercel cron invokes GET; manual triggers may use POST with { job } body.
export async function GET(req: Request) {
  try {
    guardCron(req);
    return await handleCron(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    guardCron(req);
    return await handleCron(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
