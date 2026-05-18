import { Resend } from "@resend/node";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  notificationPreferences,
  subscriptions,
} from "@/db/schema/billing";
import { profiles } from "@/db/schema/profile";
import { users } from "@/db/schema/users";
import {
  buildMonthlyIntelligenceEmailProps,
  monthlyIntelligenceSubject,
  renderMonthlyIntelligenceEmailHtml,
} from "@/emails/monthlyIntelligenceEmail";
import { computeSkillGap } from "@/lib/skillGap";
import {
  cityFromProfileLocation,
  demandRoleFromProfileTargetRole,
} from "@/lib/skillIntelligenceUserContext";

const BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.SKILL_EMAIL_BATCH_SIZE ?? "50", 10) || 50,
);

type IntelligenceRecipient = {
  userId: string;
  email: string;
  displayName: string;
  targetRole: string;
  location: string | null;
};

type SendRunStats = {
  sent: number;
  failed: number;
  skipped: number;
};

function logMonthlyIntelligence(payload: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ source: "monthlyIntelligenceEmail", ...payload }),
  );
}

function displayNameFromUser(
  email: string,
  username: string | null,
): string {
  if (username?.trim()) return username.trim();
  const local = email.split("@")[0]?.trim();
  return local && local.length >= 2 ? local : "there";
}

async function fetchIntelligenceRecipients(): Promise<IntelligenceRecipient[]> {
  const db = getDb();

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      username: users.username,
      targetRole: profiles.targetRole,
      location: profiles.location,
    })
    .from(users)
    .innerJoin(
      subscriptions,
      and(
        eq(subscriptions.userId, users.id),
        eq(subscriptions.status, "active"),
        inArray(subscriptions.plan, ["pro"]),
      ),
    )
    .innerJoin(
      notificationPreferences,
      and(
        eq(notificationPreferences.userId, users.id),
        eq(notificationPreferences.intelligenceEmails, true),
      ),
    )
    .innerJoin(profiles, eq(profiles.userId, users.id));

  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
    displayName: displayNameFromUser(row.email, row.username),
    targetRole: row.targetRole,
    location: row.location,
  }));
}

async function sendIntelligenceEmail(
  recipient: IntelligenceRecipient,
  html: string,
  subject: string,
): Promise<
  | { ok: true; resendEmailId: string | null }
  | { ok: false; error: string }
> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return { ok: false, error: "missing_resend_env" };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: recipient.email,
    subject,
    html,
  });

  if (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error ?
        String((error as { message: unknown }).message)
      : String(error);
    return { ok: false, error: message };
  }

  return { ok: true, resendEmailId: data?.id ?? null };
}

async function processRecipient(
  recipient: IntelligenceRecipient,
  sentAt: Date,
): Promise<"sent" | "skipped" | "failed"> {
  const role = demandRoleFromProfileTargetRole(recipient.targetRole);
  const city = cityFromProfileLocation(recipient.location);

  let gap;
  try {
    gap = await computeSkillGap(recipient.userId, role, city);
  } catch (error) {
    logMonthlyIntelligence({
      event: "gap_compute_failed",
      userId: recipient.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed";
  }

  const emailProps = buildMonthlyIntelligenceEmailProps({
    recipientName: recipient.displayName,
    role,
    city,
    gapScore: gap.gapScore,
    rankedSkills: gap.rankedSkills,
    sentAt,
  });

  if (!emailProps) {
    return "skipped";
  }

  const subject = monthlyIntelligenceSubject(
    emailProps.monthLabel,
    emailProps.year,
  );
  const html = renderMonthlyIntelligenceEmailHtml(emailProps);

  const result = await sendIntelligenceEmail(recipient, html, subject);
  if (!result.ok) {
    logMonthlyIntelligence({
      event: "send_failed",
      userId: recipient.userId,
      email: recipient.email,
      error: "error" in result ? result.error : "unknown",
    });
    return "failed";
  }

  logMonthlyIntelligence({
    event: "sent",
    userId: recipient.userId,
    email: recipient.email,
    gapScore: gap.gapScore,
    topSkill: emailProps.topSkill,
    liftPct: emailProps.liftPct,
  });

  return "sent";
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * Sends the monthly skill intelligence digest to active Pro users who opted in.
 * Intended to be invoked from a monthly cron worker.
 */
export async function sendMonthlyIntelligenceEmails(): Promise<void> {
  const sentAt = new Date();
  const stats: SendRunStats = { sent: 0, failed: 0, skipped: 0 };

  let recipients: IntelligenceRecipient[];
  try {
    recipients = await fetchIntelligenceRecipients();
  } catch (error) {
    logMonthlyIntelligence({
      event: "recipient_fetch_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  logMonthlyIntelligence({
    event: "run_started",
    recipientCount: recipients.length,
    batchSize: BATCH_SIZE,
  });

  for (const batch of chunk(recipients, BATCH_SIZE)) {
    const outcomes = await Promise.all(
      batch.map((recipient) => processRecipient(recipient, sentAt)),
    );

    for (const outcome of outcomes) {
      if (outcome === "sent") stats.sent += 1;
      else if (outcome === "skipped") stats.skipped += 1;
      else stats.failed += 1;
    }
  }

  logMonthlyIntelligence({
    event: "run_completed",
    sent: stats.sent,
    failed: stats.failed,
    skipped: stats.skipped,
    recipientCount: recipients.length,
  });
}
