import { ImageResponse } from "@vercel/og";
import { type NextRequest } from "next/server";

import type { Profile } from "@/db/schema/profile";
import { loadOgProfileByUsername } from "@/lib/og-profile-data";
import {
  PROFILE_TARGET_ROLE_LABELS,
  publicProfileUrl,
} from "@/lib/profileDisplay";

export const runtime = "edge";

const ROLE_COLORS: Record<Profile["targetRole"], string> = {
  AI_PM: "#8b5cf6",
  AI_GENERALIST: "#06b6d4",
  AI_ENGINEER: "#10b981",
  AI_MARKETER: "#f59e0b",
  AI_OPERATOR: "#ef4444",
  AI_FOUNDER: "#ec4899",
};

const OG_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=86400";

async function loadGoogleFont(
  font: string,
  weight: number
): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&display=swap`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }
  ).then((res) => res.text());
  const match = css.match(
    /src: url\((.+)\) format\('(?:opentype|truetype)'\)/
  );
  if (!match?.[1]) {
    throw new Error(`Failed to load font ${font} ${weight}`);
  }
  return fetch(match[1]).then((res) => res.arrayBuffer());
}

const interRegular = loadGoogleFont("Inter", 400);
const interSemiBold = loadGoogleFont("Inter", 600);

type RouteCtx = { params: Promise<{ username: string }> };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function truncateHeadline(text: string, max = 60): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function RingCenterLabel({ pct }: { pct: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 36,
          fontWeight: 600,
          color: "#ffffff",
          lineHeight: 1,
        }}
      >
        {pct}%
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          color: "#a1a1aa",
          textAlign: "center",
          maxWidth: 120,
          lineHeight: 1.2,
        }}
      >
        AI-Native Ready
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 168;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const filled = (clamped / 100) * c;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#27272a"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#a78bfa"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: "absolute", display: "flex" }}>
        <RingCenterLabel pct={clamped} />
      </div>
    </div>
  );
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { username: raw } = await ctx.params;
  const username = raw?.trim().toLowerCase();
  if (!username) {
    return new Response("Bad Request", { status: 400 });
  }

  let profile;
  try {
    profile = await loadOgProfileByUsername(username);
  } catch {
    return new Response("Not Found", { status: 404 });
  }

  if (!profile) {
    return new Response("Not Found", { status: 404 });
  }

  const roleKey = profile.targetRole as Profile["targetRole"];
  const roleLabel =
    PROFILE_TARGET_ROLE_LABELS[roleKey] ?? profile.targetRole;
  const roleColor = ROLE_COLORS[roleKey] ?? "#8b5cf6";
  const headline = truncateHeadline(
    profile.headline?.trim() ??
      `AI-Native ${roleLabel} · Aihired builder`
  );
  const displayUrl = publicProfileUrl(profile.username).replace(
    /^https:\/\//,
    ""
  );
  const avatarInitials = initials(profile.displayName);
  const skills = profile.topSkills.slice(0, 3);
  const progressPct = profile.roadmapProgressPct;

  const [fontRegular, fontSemiBold] = await Promise.all([
    interRegular,
    interSemiBold,
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "70%",
            height: "70%",
            background:
              "radial-gradient(ellipse at top left, rgba(139, 92, 246, 0.35) 0%, transparent 65%)",
          }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            padding: "48px 56px 88px",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: "60%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              paddingRight: 32,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  background: `${roleColor}33`,
                  border: `2px solid ${roleColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 600,
                  color: "#ffffff",
                  flexShrink: 0,
                }}
              >
                {avatarInitials}
              </div>
              <div
                style={{
                  marginLeft: 24,
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    color: "#ffffff",
                    lineHeight: 1.15,
                  }}
                >
                  {profile.displayName}
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 18,
                color: "#a1a1aa",
                lineHeight: 1.35,
                maxWidth: 560,
              }}
            >
              {headline}
            </div>

            <div style={{ marginTop: 20, display: "flex", flexDirection: "row" }}>
              <div
                style={{
                  background: `${roleColor}22`,
                  border: `1px solid ${roleColor}`,
                  borderRadius: 9999,
                  padding: "6px 14px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: roleColor,
                }}
              >
                {roleLabel}
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div style={{ fontSize: 14, color: "#fb923c" }}>
                🔥 {profile.streakDays} day streak
              </div>
              {profile.aiNativeVerified ? (
                <div style={{ fontSize: 14, color: "#22c55e", fontWeight: 600 }}>
                  AI-Native Verified ✓
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              width: "40%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ProgressRing pct={progressPct} />
            <div
              style={{
                marginTop: 28,
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 8,
                maxWidth: 380,
              }}
            >
              {skills.map((skill) => (
                <div
                  key={skill}
                  style={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 9999,
                    padding: "6px 12px",
                    fontSize: 13,
                    color: "#e4e4e7",
                  }}
                >
                  {skill}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 56,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 56px",
            borderTop: "1px solid #27272a",
            background: "rgba(10, 10, 10, 0.92)",
            zIndex: 2,
          }}
        >
          <div style={{ fontSize: 15, color: "#71717a" }}>{displayUrl}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#ffffff" }}>
            Aihired
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
        { name: "Inter", data: fontSemiBold, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": OG_CACHE_CONTROL },
    }
  );
}
