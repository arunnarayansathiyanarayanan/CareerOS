"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { Button } from "@/components/ui/button";
import type { ProfilePublicDTO } from "@/server/routers/profile";

export function ProfileOwnerDock({
  show,
  profileUrl,
  profile,
}: {
  show: boolean;
  profileUrl: string;
  profile: ProfilePublicDTO;
}) {
  const [copied, setCopied] = useState(false);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        type="button"
        variant="secondary"
        className="border border-zinc-700 bg-zinc-900/95 shadow-lg backdrop-blur"
        onClick={() => {
          void navigator.clipboard.writeText(profileUrl).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        <Share2 className="mr-2 h-4 w-4" aria-hidden />
        {copied ? "Copied link" : "Share profile"}
      </Button>
      <EditProfileModal profile={profile} />
    </div>
  );
}
