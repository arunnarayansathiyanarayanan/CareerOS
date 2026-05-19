import {
  formatCityLabel,
  formatDemandRoleLabel,
  marketAlignmentPercentile,
} from "@/lib/skillIntelligenceUserContext";

import { escapeHtml, skillsPageUrl } from "./shared";

export type MonthlyIntelligenceTopSkill = {
  name: string;
  expectedSalaryLiftPct: number;
};

export type MonthlyIntelligenceEmailProps = {
  recipientName: string;
  monthLabel: string;
  year: number;
  role: string;
  city: string;
  gapScore: number;
  topSkill: string;
  liftPct: number;
  top3Skills: MonthlyIntelligenceTopSkill[];
  alignmentPercentile: number;
};

export function monthlyIntelligenceSubject(
  monthLabel: string,
  year: number,
): string {
  return `Your AI career intelligence — ${monthLabel} ${year}`;
}

/**
 * Transactional HTML for the monthly skill intelligence digest.
 * Mirrors the inline template pattern used by `sendWelcomeEmail`.
 */
export function renderMonthlyIntelligenceEmailHtml(
  props: MonthlyIntelligenceEmailProps,
): string {
  const greetingName = escapeHtml(props.recipientName.trim() || "there");
  const roleLabel = escapeHtml(formatDemandRoleLabel(props.role));
  const cityLabel = escapeHtml(formatCityLabel(props.city));
  const topSkill = escapeHtml(props.topSkill);
  const liftPct = Math.round(props.liftPct);
  const percentile = props.alignmentPercentile;
  const skillsUrl = escapeHtml(skillsPageUrl());
  const gapScore = props.gapScore;

  const top3List = props.top3Skills
    .map(
      (skill) =>
        `<li style="margin:0.35rem 0;"><strong>${escapeHtml(skill.name)}</strong> — up to +${Math.round(skill.expectedSalaryLiftPct)}% salary lift potential</li>`,
    )
    .join("");

  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.55;color:#18181b;max-width:560px;">
  <p style="font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;margin:0 0 1rem;">Aihired · Skill intelligence</p>
  <p>Hi ${greetingName},</p>
  <p>Your monthly AI career intelligence for <strong>${roleLabel}</strong> roles in <strong>${cityLabel}</strong> is ready.</p>

  <div style="margin:1.25rem 0;padding:1rem 1.15rem;border-radius:12px;background:#f4f4f5;border:1px solid #e4e4e7;">
    <p style="margin:0 0 0.5rem;font-size:0.95rem;">Your skills rank in the <strong>top ${percentile}%</strong> for ${roleLabel} in ${cityLabel}.</p>
    <p style="margin:0;font-size:0.85rem;color:#52525b;">Gap score: ${gapScore}/100 (lower is closer to market demand).</p>
  </div>

  <p style="margin:1.25rem 0 0.5rem;"><strong>Add ${topSkill}</strong> → expected <strong>+${liftPct}%</strong> salary lift based on current posting bands.</p>

  ${
    top3List ?
      `<p style="margin:0.75rem 0 0.35rem;font-size:0.9rem;color:#3f3f46;">Your top 3 upskill priorities:</p>
  <ul style="margin:0 0 1rem 1.1rem;padding:0;font-size:0.9rem;color:#3f3f46;">${top3List}</ul>`
    : ""
  }

  <p style="margin:1.5rem 0 1rem;">
    <a href="${skillsUrl}" style="display:inline-block;padding:0.65rem 1.25rem;border-radius:8px;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;">View full intelligence dashboard →</a>
  </p>
  <p style="font-size:0.85rem;color:#71717a;">Open your dashboard: <a href="${skillsUrl}" style="color:#6366f1;">${escapeHtml(skillsPageUrl().replace(/^https?:\/\//, ""))}</a></p>
  <p style="margin-top:1.5rem;font-size:0.85rem;color:#a1a1aa;">You receive this because you opted in to intelligence emails on Aihired Pro. Manage preferences in account settings.</p>
  <p style="margin-top:0.5rem;">— Aihired</p>
</div>
`.trim();
}

export function buildMonthlyIntelligenceEmailProps(input: {
  recipientName: string;
  role: string;
  city: string;
  gapScore: number;
  rankedSkills: {
    name: string;
    expectedSalaryLiftPct: number;
  }[];
  sentAt?: Date;
}): MonthlyIntelligenceEmailProps | null {
  if (input.rankedSkills.length === 0) return null;

  const sentAt = input.sentAt ?? new Date();
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long" }).format(
    sentAt,
  );
  const year = sentAt.getFullYear();
  const top = input.rankedSkills[0]!;

  return {
    recipientName: input.recipientName,
    monthLabel,
    year,
    role: input.role,
    city: input.city,
    gapScore: input.gapScore,
    topSkill: top.name,
    liftPct: top.expectedSalaryLiftPct,
    top3Skills: input.rankedSkills.slice(0, 3).map((s) => ({
      name: s.name,
      expectedSalaryLiftPct: s.expectedSalaryLiftPct,
    })),
    alignmentPercentile: marketAlignmentPercentile(input.gapScore),
  };
}
