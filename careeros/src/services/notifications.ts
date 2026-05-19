import { Resend } from "@resend/node";

import { getAppOrigin } from "@/lib/brand";

/** `@resend/node` is an npm alias for the official Resend Node SDK (`resend`). */

const APP_ORIGIN = getAppOrigin();

export type WelcomeEmailUser = {
  email: string;
  name: string;
  targetRole: string;
  /** Clerk username or similar; used in PS for the public profile link */
  publicProfileSlug?: string | null;
};

function logWelcomeEmail(payload: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ source: "notifications.sendWelcomeEmail", ...payload })
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTargetRoleLabel(targetRole: string): string {
  return targetRole
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function roadmapUrl(roadmapId: string): string {
  return `${APP_ORIGIN}/roadmap?rid=${encodeURIComponent(roadmapId)}`;
}

function publicProfileUrl(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  return `${APP_ORIGIN}/profile/${encodeURIComponent(slug.trim())}`;
}

function buildWelcomeHtml(
  user: WelcomeEmailUser,
  roadmapId: string,
  roleLabel: string
): string {
  const greetingName = escapeHtml(user.name.trim() || "there");
  const rLink = escapeHtml(roadmapUrl(roadmapId));
  const profileHref = publicProfileUrl(user.publicProfileSlug);
  const psBlock =
    profileHref !== null
      ? `<p style="margin-top:1.5rem;font-size:0.9rem;color:#555;">P.S. Your public profile: <a href="${escapeHtml(profileHref)}">${escapeHtml(profileHref)}</a></p>`
      : `<p style="margin-top:1.5rem;font-size:0.9rem;color:#555;">P.S. Add a username in Aihired to get a shareable public profile link.</p>`;

  return `
<p>Hi ${greetingName},</p>
<p>Welcome — you declared <strong>${escapeHtml(roleLabel)}</strong> as your target. Your personalized roadmap is ready.</p>
<p><a href="${rLink}">Open your roadmap</a> — ${escapeHtml(`${APP_ORIGIN.replace(/^https?:\/\//, "")}/roadmap`)}</p>
<p>It breaks down phased milestones, learning focus, and concrete next actions so you always know what to work on next.</p>
<p><strong><a href="${rLink}">Start your first concept today →</a></strong></p>
${psBlock}
<p>— Aihired</p>
`.trim();
}

/**
 * Sends the onboarding welcome email via Resend (non-blocking if the caller does not await).
 * Never throws: failures are logged as structured JSON and swallowed so onboarding can complete.
 * Intended to run within minutes of onboarding completion (call from a microtask or background job).
 */
export async function sendWelcomeEmail(
  user: WelcomeEmailUser,
  roadmapId: string
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      logWelcomeEmail({
        event: "welcome_email",
        status: "skipped",
        reason: "missing_resend_env",
        roadmapId,
        email: user.email,
      });
      return;
    }

    const roleLabel = formatTargetRoleLabel(user.targetRole);
    const displayName = user.name.trim() || "there";
    const subject = `Your ${roleLabel} roadmap is ready, ${displayName}`;

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: user.email,
      subject,
      html: buildWelcomeHtml(user, roadmapId, roleLabel),
    });

    if (error) {
      logWelcomeEmail({
        event: "welcome_email",
        status: "failure",
        roadmapId,
        email: user.email,
        error:
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error),
      });
      return;
    }

    logWelcomeEmail({
      event: "welcome_email",
      status: "success",
      roadmapId,
      email: user.email,
      resendEmailId: data?.id ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logWelcomeEmail({
      event: "welcome_email",
      status: "failure",
      roadmapId,
      email: user.email,
      error: message,
    });
  }
}
