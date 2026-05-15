"use client";

import {
  BookOpen,
  ExternalLink,
  Flag,
  Hammer,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ItemDetailDrawer } from "@/components/roadmap/ItemDetailDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CHECKLIST_KEYS,
  CHECKLIST_LABELS,
  parseCompletionChecklist,
  type ChecklistKey,
} from "@/lib/completionChecklist";
import { cn } from "@/lib/utils";
import type { RoadmapItem as RoadmapItemType } from "@/types/roadmap";

const TYPE_ICON = {
  concept: BookOpen,
  project: Hammer,
  milestone: Flag,
} as const;

const STATUS_BADGE: Record<
  RoadmapItemType["status"],
  { label: string; className: string }
> = {
  not_started: {
    label: "Not started",
    className: "border-zinc-700 bg-zinc-800/80 text-zinc-400",
  },
  in_progress: {
    label: "In progress",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  },
  completed: {
    label: "Completed",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
  skipped: {
    label: "Skipped",
    className: "border-zinc-700/60 bg-zinc-900/80 text-zinc-500",
  },
};

export type RoadmapItemProps = {
  item: RoadmapItemType;
};

export function RoadmapItem({ item: initialItem }: RoadmapItemProps) {
  const [item, setItem] = useState(initialItem);
  const [descExpanded, setDescExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userNote, setUserNote] = useState(initialItem.userNote ?? "");
  const [proofUrl, setProofUrl] = useState(initialItem.proofOfWorkUrl ?? "");
  const [checklist, setChecklist] = useState(() =>
    parseCompletionChecklist(initialItem.completionChecklist)
  );
  const [patching, setPatching] = useState(false);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setItem(initialItem);
    setUserNote(initialItem.userNote ?? "");
    setProofUrl(initialItem.proofOfWorkUrl ?? "");
    setChecklist(parseCompletionChecklist(initialItem.completionChecklist));
  }, [initialItem]);

  const TypeIcon = TYPE_ICON[item.type];
  const statusBadge = STATUS_BADGE[item.status];
  const isProject = item.type === "project";
  const powMissing = isProject && !proofUrl.trim();
  const completeDisabled =
    item.status === "completed" || item.status === "skipped" || powMissing;

  const patchItem = useCallback(
    async (body: Record<string, unknown>) => {
      setPatching(true);
      try {
        const res = await fetch(`/api/roadmap/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { item: RoadmapItemType };
        setItem(data.item);
        return data.item;
      } finally {
        setPatching(false);
      }
    },
    [item.id]
  );

  function saveNote(value: string) {
    const trimmed = value.trim();
    void patchItem({ userNote: trimmed === "" ? null : trimmed });
  }

  function queueNoteSave(value: string) {
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => {
      noteSaveTimer.current = null;
      saveNote(value);
    }, 500);
  }

  function handleNoteBlur() {
    if (noteSaveTimer.current) {
      clearTimeout(noteSaveTimer.current);
      noteSaveTimer.current = null;
    }
    saveNote(userNote);
  }

  function handleProofBlur() {
    const trimmed = proofUrl.trim();
    void patchItem({ proofOfWorkUrl: trimmed === "" ? null : trimmed });
  }

  async function handleStatusChange(value: string) {
    if (value !== "in_progress" && value !== "skipped") return;
    const updated = await patchItem({ status: value });
    if (updated) setItem(updated);
  }

  async function handleChecklistToggle(key: ChecklistKey, checked: boolean) {
    const next = { ...checklist, [key]: checked };
    setChecklist(next);
    const updated = await patchItem({ completionChecklist: { [key]: checked } });
    if (updated) {
      setChecklist(parseCompletionChecklist(updated.completionChecklist));
    }
  }

  const description = item.description;
  const shouldTruncate = description.length > 140;
  const displayDescription =
    descExpanded || !shouldTruncate ?
      description
    : `${description.slice(0, 140).trimEnd()}…`;

  return (
    <TooltipProvider>
      <article
        className={cn(
          "rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-4 transition-colors",
          item.status === "in_progress" && "border-blue-500/25",
          item.status === "completed" && "border-zinc-700/80"
        )}
      >
        <div className="flex gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400"
            aria-hidden
          >
            <TypeIcon className="size-4" />
          </span>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3
                className={cn(
                  "text-sm font-semibold text-zinc-100",
                  item.status === "completed" && "text-zinc-400 line-through"
                )}
              >
                {item.title}
              </h3>
              <Badge
                variant="outline"
                className={cn("shrink-0 text-[10px]", statusBadge.className)}
              >
                {statusBadge.label}
              </Badge>
            </div>

            <p
              role={shouldTruncate ? "button" : undefined}
              tabIndex={shouldTruncate ? 0 : undefined}
              onClick={
                shouldTruncate ?
                  () => setDescExpanded((v) => !v)
                : undefined
              }
              onKeyDown={
                shouldTruncate ?
                  (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDescExpanded((v) => !v);
                    }
                  }
                : undefined
              }
              className={cn(
                "text-sm leading-relaxed text-zinc-400",
                shouldTruncate && "cursor-pointer hover:text-zinc-300"
              )}
            >
              {displayDescription}
              {shouldTruncate && (
                <span className="ml-1 text-xs text-[#E5FF47]">
                  {descExpanded ? "Show less" : "Read more"}
                </span>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <DifficultyDots value={item.difficulty} />
              <Badge
                variant="outline"
                className="border-zinc-700 bg-zinc-900/80 text-zinc-400"
              >
                {item.estimatedHours}h est.
              </Badge>
              {patching && (
                <Loader2
                  className="size-3.5 animate-spin text-zinc-500"
                  aria-label="Saving"
                />
              )}
            </div>
          </div>
        </div>

        {item.type === "concept" && item.externalLinks.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-zinc-800/80 pt-3">
            {item.externalLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#E5FF47] hover:underline"
                >
                  {link.label}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}

        {isProject && (
          <div className="mt-3 space-y-3 border-t border-zinc-800/80 pt-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">
                Proof-of-work URL
              </span>
              <Input
                type="url"
                placeholder="https://github.com/…"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                onBlur={handleProofBlur}
                disabled={item.status === "completed"}
                className="border-zinc-800 bg-zinc-900/50"
              />
            </label>

            <fieldset className="space-y-2" disabled={powMissing}>
              <legend className="text-xs font-medium text-zinc-400">
                Completion checklist
              </legend>
              {CHECKLIST_KEYS.map((key) => (
                <label
                  key={key}
                  className={cn(
                    "flex items-center gap-2 text-sm text-zinc-300",
                    powMissing && "opacity-50"
                  )}
                >
                  <Checkbox
                    checked={checklist[key]}
                    onCheckedChange={(checked) =>
                      void handleChecklistToggle(key, checked === true)
                    }
                    disabled={powMissing || item.status === "completed"}
                  />
                  {CHECKLIST_LABELS[key]}
                </label>
              ))}
              {powMissing && (
                <p className="text-xs text-zinc-500">
                  Add a proof-of-work link to enable the checklist.
                </p>
              )}
            </fieldset>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800/80 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={
                item.status === "skipped" ? "skipped"
                : item.status === "in_progress" ? "in_progress"
                : undefined
              }
              onValueChange={(v) => void handleStatusChange(v)}
              disabled={
                item.status === "completed" || item.status === "skipped"
              }
            >
              <SelectTrigger
                size="sm"
                className="border-zinc-800 bg-zinc-900/50"
                aria-label="Update status"
              >
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">Mark in progress</SelectItem>
                <SelectItem value="skipped">Skip</SelectItem>
              </SelectContent>
            </Select>

            {powMissing ?
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#E5FF47] text-zinc-950 hover:bg-[#E5FF47]/90 disabled:opacity-50"
                      disabled
                    >
                      Mark complete
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Add proof-of-work link first
                </TooltipContent>
              </Tooltip>
            : <Button
                type="button"
                size="sm"
                className="bg-[#E5FF47] text-zinc-950 hover:bg-[#E5FF47]/90 disabled:opacity-50"
                disabled={completeDisabled}
                onClick={() => setDrawerOpen(true)}
              >
                Mark complete
              </Button>
            }
          </div>

          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-xs font-medium text-zinc-500">Note</span>
            <Input
              value={userNote}
              onChange={(e) => {
                setUserNote(e.target.value);
                queueNoteSave(e.target.value);
              }}
              onBlur={handleNoteBlur}
              placeholder="Add a personal note…"
              disabled={item.status === "completed"}
              className="border-zinc-800 bg-zinc-900/50"
            />
          </label>
        </div>

        <ItemDetailDrawer
          item={item}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onItemUpdated={setItem}
        />
      </article>
    </TooltipProvider>
  );
}

function DifficultyDots({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Difficulty ${value} out of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full border",
            i < value ?
              "border-[#E5FF47]/60 bg-[#E5FF47]"
            : "border-zinc-700 bg-zinc-800"
          )}
        />
      ))}
    </span>
  );
}
