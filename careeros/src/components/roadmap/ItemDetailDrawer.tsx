"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ITEM_TYPE_FILTER_LABEL } from "@/lib/roadmapDisplay";
import type { RoadmapItem } from "@/types/roadmap";

export type ItemDetailDrawerProps = {
  item: RoadmapItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemUpdated?: (item: RoadmapItem) => void;
};

export function ItemDetailDrawer({
  item,
  open,
  onOpenChange,
  onItemUpdated,
}: ItemDetailDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/roadmap/${item.roadmapId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          ...(item.proofOfWorkUrl?.trim() ?
            { proofOfWorkUrl: item.proofOfWorkUrl.trim() }
          : {}),
        }),
      });

      const data = (await res.json()) as {
        item?: RoadmapItem;
        reason?: string;
        error?: string;
      };

      if (!res.ok) {
        toast.error(data.reason ?? data.error ?? "Could not mark complete");
        return;
      }

      if (data.item) {
        onItemUpdated?.(data.item);
      }
      toast.success("Item marked complete");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "fixed top-0 right-0 left-auto flex h-full max-h-none w-full max-w-md translate-x-0 translate-y-0 flex-col rounded-none border-l border-zinc-800 bg-zinc-950 sm:max-w-md",
          "data-open:slide-in-from-right data-closed:slide-out-to-right"
        )}
      >
        <DialogHeader className="text-left">
          <Badge
            variant="outline"
            className="w-fit border-zinc-700 text-[10px] uppercase tracking-wider text-zinc-400"
          >
            {ITEM_TYPE_FILTER_LABEL[item.type]}
          </Badge>
          <DialogTitle className="text-lg text-zinc-50">{item.title}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {item.description}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <DetailField label="Estimated" value={`${item.estimatedHours}h`} />
            <DetailField label="Difficulty" value={`${item.difficulty} / 5`} />
            <DetailField label="Status" value={formatStatus(item.status)} />
          </dl>

          {item.techStack.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.techStack.map((tech) => (
                <Badge
                  key={tech}
                  variant="secondary"
                  className="bg-zinc-800/80 text-zinc-300"
                >
                  {tech}
                </Badge>
              ))}
            </div>
          )}

          {item.proofOfWorkUrl?.trim() && (
            <a
              href={item.proofOfWorkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[#E5FF47] hover:underline"
            >
              Proof of work
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}

          {item.userNote?.trim() && (
            <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400">
              {item.userNote}
            </p>
          )}
        </div>

        <DialogFooter className="mt-auto border-t border-zinc-800 bg-zinc-950/80 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#E5FF47] text-zinc-950 hover:bg-[#E5FF47]/90"
            onClick={() => void handleComplete()}
            disabled={submitting || item.status === "completed"}
          >
            {submitting ?
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Completing…
              </>
            : item.status === "completed" ?
              "Completed"
            : "Confirm complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-zinc-200">{value}</dd>
    </div>
  );
}

function formatStatus(status: RoadmapItem["status"]): string {
  return status.replace(/_/g, " ");
}
