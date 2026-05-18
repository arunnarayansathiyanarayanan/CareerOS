"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileIcon,
  FileTextIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { TARGET_ROLE_OPTIONS } from "@/components/resume/constants";
import type { ResumeVariantClient } from "@/components/resume/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TargetRole } from "@/lib/resume/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".docx")) return "DOCX";
  if (name.endsWith(".txt")) return "TXT";
  return file.type || "File";
}

type UploadZoneProps = {
  onVariantsReady: (
    variants: ResumeVariantClient[],
    meta: {
      resumeId: string;
      versionId: string;
      targetRole: TargetRole;
    }
  ) => void;
  onResumeCreated?: (meta: {
    resumeId: string;
    versionId: string;
    targetRole: TargetRole;
  }) => void;
  onGeneratingChange: (generating: boolean) => void;
  onGenerationError: (message: string | null) => void;
  disabled?: boolean;
};

export function UploadZone({
  onVariantsReady,
  onResumeCreated,
  onGeneratingChange,
  onGenerationError,
  disabled = false,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [targetRole, setTargetRole] = useState<TargetRole | "">("");
  const [jobDescription, setJobDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setFileSafe = useCallback((next: File | null) => {
    if (next && next.size > MAX_BYTES) {
      toast.error("File must be 5MB or smaller");
      return;
    }
    setFile(next);
  }, []);

  async function pollJob(
    jobId: string
  ): Promise<ResumeVariantClient[] | "failed"> {
    for (;;) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`/api/resume/jobs/${jobId}`);
      const data = (await res.json()) as {
        status?: string;
        variants?: ResumeVariantClient[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Job status check failed");
      }
      if (data.status === "failed") return "failed";
      if (data.status === "done" && data.variants) {
        return data.variants.map((v) => ({
          ...v,
          createdAt:
            typeof v.createdAt === "string"
              ? v.createdAt
              : new Date(v.createdAt as unknown as string).toISOString(),
        }));
      }
    }
  }

  async function handleAnalyze() {
    if (!file || !targetRole) return;
    setSubmitting(true);
    onGenerationError(null);
    onGeneratingChange(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetRole", targetRole);

      const uploadRes = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = (await uploadRes.json()) as {
        resumeId?: string;
        versionId?: string;
        error?: string;
      };
      if (!uploadRes.ok) {
        throw new Error(uploadData.error ?? "Upload failed");
      }

      const versionId = uploadData.versionId!;
      const resumeId = uploadData.resumeId!;

      onResumeCreated?.({ resumeId, versionId, targetRole });

      const genRes = await fetch(`/api/resume/versions/${versionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole,
          jobDescription: jobDescription.trim() || undefined,
        }),
      });
      const genData = (await genRes.json()) as {
        jobId?: string;
        error?: string;
      };
      if (!genRes.ok) {
        throw new Error(genData.error ?? "Generation failed to start");
      }

      const result = await pollJob(genData.jobId!);
      if (result === "failed") {
        toast.error("Resume generation failed. Please try again.");
        onGenerationError("Generation failed. Please try again.");
        return;
      }

      onVariantsReady(result, { resumeId, versionId, targetRole });
      toast.success("Your resume variants are ready");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
      onGenerationError(message);
    } finally {
      setSubmitting(false);
      onGeneratingChange(false);
    }
  }

  const canSubmit = Boolean(file && targetRole) && !submitting && !disabled;

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          setFileSafe(picked);
          e.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) setFileSafe(dropped);
        }}
        className={cn(
          "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver
            ? "border-[#6366F1] bg-[#6366F1]/5"
            : "border-zinc-700 hover:border-zinc-500"
        )}
      >
        {file ? (
          <div
            className="flex w-full max-w-sm items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <FileIcon className="size-8 shrink-0 text-[#6366F1]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">
                {file.name}
              </p>
              <p className="text-xs text-zinc-500">
                {formatFileSize(file.size)} · {fileTypeLabel(file)}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Remove file"
              onClick={() => setFile(null)}
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <FileTextIcon className="mb-3 size-10 text-zinc-500" />
            <p className="text-base font-medium text-zinc-200">
              Drop your resume here
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              PDF, DOCX, or TXT · Max 5MB
            </p>
            <p className="mt-3 text-xs text-zinc-600">or click to browse</p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="target-role">Target role</Label>
        <Select
          value={targetRole}
          onValueChange={(v) => setTargetRole(v as TargetRole)}
          disabled={disabled || submitting}
        >
          <SelectTrigger id="target-role" className="w-full">
            <SelectValue placeholder="Select a target role" />
          </SelectTrigger>
          <SelectContent>
            {TARGET_ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="job-description">Job description (optional)</Label>
        <Textarea
          id="job-description"
          rows={4}
          placeholder="Paste the job description you're targeting — improves keyword match accuracy"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          disabled={disabled || submitting}
          className="resize-none"
        />
      </div>

      <Button
        type="button"
        className="w-full bg-[#6366F1] text-white hover:bg-[#6366F1]/90"
        disabled={!canSubmit}
        onClick={() => void handleAnalyze()}
      >
        {submitting ? (
          <>
            <Loader2Icon className="animate-spin" />
            Analyzing…
          </>
        ) : (
          "Analyze Resume"
        )}
      </Button>
    </div>
  );
}
