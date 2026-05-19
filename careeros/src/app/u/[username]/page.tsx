import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { Suspense } from "react";

import type { ProfileActivityItem } from "@/components/profile/ActivityTimeline";
import {
  ProfileActivityIsland,
  ProfileSkillGraphIsland,
} from "@/components/profile/ProfileClientIslands";
import {
  EndorsementsSkeleton,
} from "@/components/profile/profile-skeletons";
import { ContactCTA } from "@/components/profile/ContactCTA";
import { EndorsementsSection } from "@/components/profile/EndorsementsSection";
import { PinnedProjects } from "@/components/profile/PinnedProjects";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileViewsPanel } from "@/components/profile/ProfileViewsPanel";
import { ProfileOwnerDock } from "@/components/profile/ProfileOwnerDock";
import { ProfileViewTracker } from "@/components/profile/ProfileViewTracker";
import { InterviewReadinessSection } from "@/components/profile/InterviewReadinessSection";
import { RoadmapProgress } from "@/components/profile/RoadmapProgress";
import { StreakBadge } from "@/components/profile/StreakBadge";
import {
  PROFILE_TARGET_ROLE_LABELS,
  publicProfileUrl,
} from "@/lib/profileDisplay";
import { projectPublicUrl } from "@/lib/projectsUrls";
import { createCaller } from "@/server/caller";
import type { ProfilePublicDTO } from "@/server/routers/profile";
import { getTopPublicProfileUsernamesByViews } from "@/server/routers/profile";
import { createTRPCContext } from "@/server/trpc";

import type { Profile } from "@/db/schema/profile";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ username: string }>;
};

function isNotFoundTrpc(e: unknown): boolean {
  return e instanceof TRPCError && e.code === "NOT_FOUND";
}

async function loadPublicProfile(
  username: string
): Promise<ProfilePublicDTO> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  try {
    return await caller.profile.getByUsername({
      username: username.trim().toLowerCase(),
    });
  } catch (e) {
    if (isNotFoundTrpc(e)) notFound();
    throw e;
  }
}

export async function generateStaticParams() {
  const rows = await getTopPublicProfileUsernamesByViews(1000);
  return rows.map((r) => ({ username: r.username }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username: raw } = await params;
  const profile = await loadPublicProfile(raw.trim().toLowerCase());

  const roleLabel =
    PROFILE_TARGET_ROLE_LABELS[
      profile.targetRole as Profile["targetRole"]
    ] ?? profile.targetRole;
  const headline =
    profile.headline?.trim() ?? `${profile.displayName} on Aihired`;
  const title = `${profile.displayName} — AI-Native ${roleLabel} | Aihired`;
  const description = `${headline} · ${profile.streakDays}-day building streak · ${profile.roadmapProgressPct}% to AI-Native Ready`;
  const canonical = publicProfileUrl(profile.username);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      url: canonical,
      title,
      description,
      images: [
        {
          url: `/api/og/profile/${encodeURIComponent(profile.username)}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/og/profile/${encodeURIComponent(profile.username)}`],
    },
  };
}

function buildActivityItems(profile: ProfilePublicDTO): ProfileActivityItem[] {
  const items: ProfileActivityItem[] = [
    {
      id: "streak",
      title: `${profile.streakDays}-day building streak`,
      subtitle: "Consistency tracked on Aihired",
    },
    {
      id: "roadmap",
      title: `${profile.roadmapProgressPct}% to AI-Native Ready`,
      subtitle: "Roadmap progress toward a verified AI-native portfolio",
    },
  ];

  for (const p of profile.pinnedProjects) {
    items.push({
      id: `pinned-${p.id}`,
      title: `Pinned · ${p.title}`,
      subtitle: p.oneLiner,
    });
  }

  return items.slice(0, 10);
}

function profileJsonLd(profile: ProfilePublicDTO) {
  const canonical = publicProfileUrl(profile.username);
  const roleLabel =
    PROFILE_TARGET_ROLE_LABELS[
      profile.targetRole as Profile["targetRole"]
    ] ?? profile.targetRole;

  const sameAs = profile.customDomain?.trim()
    ? [
        profile.customDomain.startsWith("http")
          ? profile.customDomain
          : `https://${profile.customDomain}`,
      ]
    : undefined;

  const person: Record<string, unknown> = {
    "@type": "Person",
    name: profile.displayName,
    url: canonical,
    jobTitle: `AI-Native ${roleLabel}`,
    description:
      profile.headline ??
      `${profile.streakDays}-day building streak · ${profile.roadmapProgressPct}% to AI-Native Ready`,
  };

  if (profile.imageUrl) {
    person.image = profile.imageUrl;
  }
  if (sameAs) {
    person.sameAs = sameAs;
  }

  const itemList = {
    "@type": "ItemList",
    name: "Featured projects",
    itemListElement: profile.pinnedProjects.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "CreativeWork",
        name: p.title,
        url: projectPublicUrl(p.username, p.slug),
        description: p.oneLiner,
      },
    })),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [person, itemList],
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username: raw } = await params;
  const profile = await loadPublicProfile(raw);
  const canonical = publicProfileUrl(profile.username);
  const jsonLd = profileJsonLd(profile);
  const activityItems = buildActivityItems(profile);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProfileViewTracker username={profile.username} />
      <ProfileOwnerDock
        show={profile.viewerIsOwner}
        profileUrl={canonical}
        profile={profile}
      />

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto max-w-5xl px-4 pb-40 pt-2 sm:px-6 md:pb-32">
          <ProfileHero profile={profile} />
          <ProfileViewsPanel isOwner={profile.viewerIsOwner} />

          <div className="mt-10 grid min-h-[320px] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:items-start">
            <ProfileSkillGraphIsland entries={profile.skillGraphTop} />
            <div className="min-h-[88px] space-y-4 lg:sticky lg:top-6">
              <RoadmapProgress pct={profile.roadmapProgressPct} />
              <StreakBadge days={profile.streakDays} />
            </div>
          </div>

          {profile.interviewReadiness ? (
            <section className="mt-12">
              <InterviewReadinessSection
                scores={profile.interviewReadiness.scores}
              />
            </section>
          ) : null}

          <section className="mt-12 min-h-[200px] space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Pinned projects
            </h2>
            <PinnedProjects projects={profile.pinnedProjects} />
          </section>

          <section className="mt-12 min-h-[160px] space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Endorsements
            </h2>
            <Suspense fallback={<EndorsementsSkeleton />}>
              <EndorsementsSection username={profile.username} />
            </Suspense>
          </section>

          <ProfileActivityIsland items={activityItems} />

          <section className="mt-12 min-h-[120px]">
            <ContactCTA
              viewerIsOwner={profile.viewerIsOwner}
              pinned={profile.pinnedProjects}
            />
          </section>
        </main>
      </div>
    </>
  );
}
