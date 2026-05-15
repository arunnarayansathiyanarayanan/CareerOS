import { ImageResponse } from "@vercel/og";
import { type NextRequest } from "next/server";

import { loadPublicProjectPage } from "@/lib/publicProjectPage";
import { projectPublicDisplayUrl } from "@/lib/projectsUrls";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim();
  const slug = searchParams.get("slug")?.trim();
  if (!username || !slug) {
    return new Response("Bad Request", { status: 400 });
  }

  const project = await loadPublicProjectPage(username, slug);
  if (!project) {
    return new Response("Not Found", { status: 404 });
  }

  const displayUrl = projectPublicDisplayUrl(username, slug);
  const tags = project.autoTags.slice(0, 4);
  const score = project.aiReviewerScore;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0A0A0A",
          position: "relative",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "30%",
            background:
              "linear-gradient(270deg, rgba(99, 102, 241, 0.28) 0%, rgba(10, 10, 10, 0) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 48,
            fontSize: 18,
            color: "#ffffff",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            zIndex: 1,
          }}
        >
          CareerOS
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "72px 100px 140px",
            zIndex: 1,
            width: "100%",
            maxWidth: 1040,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.15,
              maxWidth: 920,
              maxHeight: 128,
              overflow: "hidden",
            }}
          >
            {project.title}
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 26,
              color: "#A0A0A0",
              textAlign: "center",
              maxWidth: 920,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {project.oneLiner}
          </div>
          <div
            style={{
              marginTop: 28,
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 10,
              maxWidth: 920,
            }}
          >
            {tags.map((t, i) => (
              <div
                key={`${i}:${t}`}
                style={{
                  background: "#1A1A1A",
                  border: "1px solid #333333",
                  borderRadius: 9999,
                  padding: "8px 16px",
                  fontSize: 18,
                  color: "#E5E5E5",
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 48,
            right: 48,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 22, color: "#A0A0A0" }}>{displayUrl}</div>
          {score != null ? (
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#6366F1",
              }}
            >
              Score: {score}/10
            </div>
          ) : null}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
