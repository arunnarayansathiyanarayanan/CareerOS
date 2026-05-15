import { CheckCircle2, MapPin } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import {
  PROFILE_AVAILABILITY_LABELS,
  PROFILE_TARGET_ROLE_LABELS,
} from "@/lib/profileDisplay";
import type { Profile } from "@/db/schema/profile";
import type { ProfilePublicDTO } from "@/server/routers/profile";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ProfileHero({ profile }: { profile: ProfilePublicDTO }) {
  const roleLabel =
    PROFILE_TARGET_ROLE_LABELS[
      profile.targetRole as Profile["targetRole"]
    ] ?? profile.targetRole;
  const availabilityLabel =
    PROFILE_AVAILABILITY_LABELS[
      profile.availabilityStatus as Profile["availabilityStatus"]
    ] ?? profile.availabilityStatus;
  const accent = initials(profile.displayName);

  return (
    <section className="border-b border-zinc-800 pb-10 pt-8 md:pb-12 md:pt-10">
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-lg md:h-32 md:w-32">
          {profile.imageUrl ? (
            <Image
              src={profile.imageUrl}
              alt=""
              width={256}
              height={256}
              priority
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-3xl font-semibold text-indigo-200"
              aria-hidden
            >
              {accent}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {profile.displayName}
            </h1>
            {profile.aiNativeVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800/60 bg-emerald-950/50 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Verified
              </span>
            ) : null}
          </div>

          <p className="max-w-2xl text-lg text-zinc-400">
            {profile.headline?.trim() ??
              `Building in public toward AI-native proof of work.`}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="border border-indigo-800/50 bg-indigo-950/60 font-medium text-indigo-100"
            >
              AI-Native {roleLabel}
            </Badge>
            <Badge
              variant="outline"
              className="border-zinc-700 bg-zinc-900/60 font-normal text-zinc-300"
            >
              {availabilityLabel}
            </Badge>
            {profile.location ? (
              <Badge
                variant="outline"
                className="border-zinc-700 bg-zinc-900/50 font-normal text-zinc-300"
              >
                <MapPin className="mr-1 h-3 w-3" aria-hidden />
                {profile.location}
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              className="border-zinc-700 font-mono text-xs font-normal text-zinc-400"
            >
              @{profile.username}
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
