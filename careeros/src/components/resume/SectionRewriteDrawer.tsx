"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { DiffViewer } from "@/components/resume/DiffViewer";
import { SECTION_LABELS } from "@/components/resume/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DiffHunk } from "@/lib/resume/sectionRewriter";
import type { SectionName, TargetRole } from "@/lib/resume/types";

type SectionRewriteDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId: string;
  sectionName: SectionName;
  originalText: string;
  targetRole: TargetRole;
  onApplied: () => void;
};

export function SectionRewriteDrawer({
  open,
  onOpenChange,
  variantId,
  sectionName,
  originalText,
  targetRole,
  onApplied,
}: SectionRewriteDrawerProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [sectionRewriteId, setSectionRewriteId] = useState<string | null>(null);
  const [diffHunks, setDiffHunks] = useState<DiffHunk[] | null>(null);

  async function handleRewrite() {
    setLoading(true);
    setSectionRewriteId(null);
    setDiffHunks(null);
    try {
      const res = await fetch(`/api/resume/variant/${variantId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionName,
          originalText,
          userInstruction: instruction.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        sectionRewriteId?: string;
        diffHunks?: DiffHunk[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Rewrite failed");
      }
      setSectionRewriteId(data.sectionRewriteId ?? null);
      setDiffHunks(data.diffHunks ?? null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not rewrite section"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!sectionRewriteId) return;
    setApplying(true);
    try {
      const res = await fetch(
        `/api/resume/rewrite/${sectionRewriteId}/apply`,
        { method: "POST" }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not apply rewrite");
      }
      toast.success("Section updated");
      onApplied();
      onOpenChange(false);
      setSectionRewriteId(null);
      setDiffHunks(null);
      setInstruction("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not apply changes"
      );
    } finally {
      setApplying(false);
    }
  }

  function handleDiscard() {
    onOpenChange(false);
    setSectionRewriteId(null);
    setDiffHunks(null);
    setInstruction("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[100vw] overflow-y-auto sm:max-w-[480px]"
      >
        <SheetHeader>
          <SheetTitle>{SECTION_LABELS[sectionName]}</SheetTitle>
          <SheetDescription className="sr-only">
            Rewrite this resume section with AI
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 py-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">Original</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-gray-50 p-3 text-sm text-zinc-800 dark:bg-gray-900 dark:text-zinc-200">
              {originalText}
            </pre>
          </div>

          <Input
            placeholder="Optional: tell AI how to rewrite — e.g. 'more concise' or 'emphasize AI tools'"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />

          <Button
            type="button"
            className="w-full bg-[#6366F1] text-white hover:bg-[#6366F1]/90"
            onClick={() => void handleRewrite()}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2Icon className="animate-spin" />
                Rewriting…
              </>
            ) : (
              "Rewrite with AI"
            )}
          </Button>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2Icon className="size-8 animate-spin text-[#6366F1]" />
            </div>
          ) : null}

          {diffHunks ? (
            <div className="rounded-lg border border-zinc-800 p-3">
              <DiffViewer diffHunks={diffHunks} />
            </div>
          ) : null}
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={handleDiscard}
            disabled={applying}
          >
            Discard
          </Button>
          <Button
            type="button"
            className="bg-[#6366F1] text-white hover:bg-[#6366F1]/90"
            onClick={() => void handleApply()}
            disabled={!sectionRewriteId || !diffHunks || applying}
          >
            {applying ? "Applying…" : "Apply changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
