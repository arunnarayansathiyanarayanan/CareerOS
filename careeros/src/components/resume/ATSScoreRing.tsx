"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ATS_BREAKDOWN_ROWS } from "@/components/resume/constants";
import { TARGET_ROLE_KEYWORDS } from "@/lib/resume/atsScorer";
import type { ATSBreakdown, TargetRole } from "@/lib/resume/types";

const CIRCUMFERENCE = 2 * Math.PI * 40;

function scoreStrokeColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function barColor(score: number, max: number): string {
  const ratio = score / max;
  if (ratio >= 0.7) return "bg-green-500";
  if (ratio >= 0.5) return "bg-amber-500";
  return "bg-red-500";
}

export function ATSScoreRing({
  score,
  breakdown,
  targetRole,
  variantSkills,
}: {
  score: number;
  breakdown: ATSBreakdown;
  targetRole: TargetRole;
  variantSkills: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const filled = (score / 100) * CIRCUMFERENCE;
  const dasharray = `${filled} ${CIRCUMFERENCE - filled}`;

  const missingKeywords = useMemo(() => {
    const skillsLower = variantSkills.map((s) => s.toLowerCase());
    return TARGET_ROLE_KEYWORDS[targetRole].filter(
      (kw) => !skillsLower.some((s) => s.includes(kw.toLowerCase()))
    );
  }, [targetRole, variantSkills]);

  const visibleMissing = missingKeywords.slice(0, 10);
  const extraMissing = missingKeywords.length - visibleMissing.length;

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex flex-col items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
        aria-expanded={expanded}
      >
        <svg viewBox="0 0 100 100" className="h-36 w-36" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
            className="dark:stroke-zinc-700"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={scoreStrokeColor(score)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={dasharray}
            strokeDashoffset={-62.8}
            transform="rotate(-90 50 50)"
          />
          <text
            x="50"
            y="48"
            textAnchor="middle"
            className="fill-zinc-900 text-[20px] font-bold dark:fill-zinc-100"
          >
            {score}
          </text>
          <text
            x="50"
            y="62"
            textAnchor="middle"
            className="fill-zinc-500 text-[10px] dark:fill-zinc-400"
          >
            / 100
          </text>
        </svg>
        <span className="text-sm text-gray-500 dark:text-zinc-400">ATS Score</span>
      </button>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-[#6366F1] hover:underline"
      >
        See breakdown →
      </button>

      {expanded ? (
        <div className="w-full space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {ATS_BREAKDOWN_ROWS.map((row) => {
            const value = breakdown[row.key];
            const pct = Math.min(100, Math.round((value / row.max) * 100));
            return (
              <div key={row.key} className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{row.label}</span>
                  <span>
                    {value}/{row.max}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(value, row.max)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}

          {visibleMissing.length > 0 ? (
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-xs font-medium text-zinc-400">Missing keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {visibleMissing.map((kw) => (
                  <Badge
                    key={kw}
                    variant="secondary"
                    className="bg-zinc-800 text-zinc-400"
                  >
                    {kw}
                  </Badge>
                ))}
                {extraMissing > 0 ? (
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-500">
                    + {extraMissing} more
                  </Badge>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
