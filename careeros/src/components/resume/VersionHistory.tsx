"use client";

import { useState } from "react";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type VersionRow =
  | {
      id: string;
      versionNumber: number;
      createdAt: string;
      expired?: false;
    }
  | {
      id: string;
      versionNumber: number;
      createdAt: string;
      expired: true;
    };

function formatVersionDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function VersionHistory({
  resumeId,
  currentVersionId,
  onVersionSelect,
}: {
  resumeId: string;
  currentVersionId: string;
  onVersionSelect: (versionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<VersionRow[] | null>(null);

  async function loadVersions() {
    if (versions !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/resume/${resumeId}/versions`);
      const data = (await res.json()) as {
        versions?: VersionRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load versions");
      }
      setVersions(
        (data.versions ?? []).map((v) => ({
          ...v,
          createdAt:
            typeof v.createdAt === "string"
              ? v.createdAt
              : new Date(v.createdAt as unknown as string).toISOString(),
        }))
      );
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadVersions();
      }}
      className="mt-8 border-t border-zinc-800 pt-6"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium text-zinc-300 hover:text-zinc-100">
        <ChevronDownIcon
          className={cn(
            "size-4 transition-transform",
            open && "rotate-180"
          )}
        />
        Version history
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-1">
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-zinc-500">
            <Loader2Icon className="size-4 animate-spin" />
            Loading…
          </div>
        ) : null}
        {versions?.map((version) => {
          const label = `Version ${version.versionNumber} · ${formatVersionDate(version.createdAt)}`;
          const isCurrent = version.id === currentVersionId;
          const isExpired = "expired" in version && version.expired;

          if (isExpired) {
            return (
              <div
                key={version.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 opacity-50"
              >
                <span className="cursor-not-allowed text-sm text-zinc-500">
                  {label}
                </span>
                <Badge
                  variant="secondary"
                  className="text-xs text-zinc-500"
                >
                  Expired
                </Badge>
              </div>
            );
          }

          return (
            <button
              key={version.id}
              type="button"
              onClick={() => onVersionSelect(version.id)}
              className={cn(
                "w-full rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-zinc-900",
                isCurrent
                  ? "bg-zinc-900 font-medium text-[#6366F1]"
                  : "text-zinc-300"
              )}
            >
              {label}
            </button>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
