"use client";

import { FileUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/button";
import {
  trackOnboardingResumeSkipped,
  trackOnboardingResumeUploaded,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/store/onboardingStore";

const MAX_BYTES = 5 * 1024 * 1024;

const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const;

export type ResumeSubmissionData = {
  resumeUrl: string | null;
  resumeParsed: Record<string, unknown> | null;
  skillCount: number | null;
};

type ResumeApiSuccess = {
  success: true;
  resumeUrl: string;
  resumeParsed: Record<string, unknown>;
  skillsExtracted: string[];
};

type ResumeApiError = {
  error?: string;
  code?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadResumeWithProgress(
  file: File,
  onProgress: (pct: number) => void,
  signal: AbortSignal
): Promise<ResumeApiSuccess> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/onboarding/resume");
    xhr.responseType = "json";

    const abort = () => {
      xhr.abort();
    };
    signal.addEventListener("abort", abort);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };

    xhr.onload = () => {
      signal.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        const body = xhr.response as ResumeApiSuccess | ResumeApiError;
        if (
          body &&
          typeof body === "object" &&
          "success" in body &&
          body.success === true &&
          typeof (body as ResumeApiSuccess).resumeUrl === "string"
        ) {
          resolve(body as ResumeApiSuccess);
          return;
        }
      }
      const errBody = (xhr.response ?? {}) as ResumeApiError;
      reject(
        new Error(
          typeof errBody.error === "string" ? errBody.error : "Upload failed"
        )
      );
    };

    xhr.onerror = () => {
      signal.removeEventListener("abort", abort);
      reject(new Error("Network error"));
    };

    xhr.onabort = () => {
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };

    const formData = new FormData();
    formData.append("resume", file);
    xhr.send(formData);
  });
}

export function StepResumeUpload({
  onResumeDataChange,
  onContinue,
  onBack,
  continueExtraDisabled = false,
  continueBlockedHint,
}: {
  onResumeDataChange: (data: ResumeSubmissionData) => void;
  onContinue: () => void;
  onBack?: () => void;
  /** When true, disables Continue (e.g. until another field on the same step is valid). */
  continueExtraDisabled?: boolean;
  /** Shown when Continue is blocked only by `continueExtraDisabled` (e.g. resume OK but another field missing). */
  continueBlockedHint?: string | null;
}) {
  const resumeFile = useOnboardingStore((s) => s.resumeFile);
  const setResumeFile = useOnboardingStore((s) => s.setResumeFile);
  const setResumeUploaded = useOnboardingStore((s) => s.setResumeUploaded);

  const onResumeDataChangeRef = useRef(onResumeDataChange);
  onResumeDataChangeRef.current = onResumeDataChange;

  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeParsed, setResumeParsed] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [skillsExtracted, setSkillsExtracted] = useState<string[]>([]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [parseFailed, setParseFailed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const resumeSkipEventSentRef = useRef(false);

  const resetUploadOutcome = useCallback(() => {
    setResumeUrl(null);
    setResumeParsed(null);
    setSkillsExtracted([]);
    setParseFailed(false);
    setUploadError(null);
    setUploadProgress(0);
    setResumeUploaded(false);
  }, [setResumeUploaded]);

  const runUpload = useCallback(
    async (file: File) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setUploading(true);
      setParseFailed(false);
      setUploadError(null);
      setUploadProgress(0);
      setSkipped(false);
      setRejectMessage(null);
      setResumeUploaded(false);
      resumeSkipEventSentRef.current = false;

      try {
        const result = await uploadResumeWithProgress(
          file,
          setUploadProgress,
          ac.signal
        );
        setResumeUrl(result.resumeUrl);
        setResumeParsed(result.resumeParsed);
        setSkillsExtracted(result.skillsExtracted ?? []);
        setResumeUploaded(true);
        setUploadProgress(100);
        trackOnboardingResumeUploaded({
          skillsExtracted: (result.skillsExtracted ?? []).length,
          parseSuccess: true,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const message =
          e instanceof Error && e.message ? e.message : "Upload failed";
        setParseFailed(true);
        setUploadError(message);
        setResumeUrl(null);
        setResumeParsed(null);
        setSkillsExtracted([]);
        setResumeUploaded(false);
        setUploadProgress(0);
        trackOnboardingResumeUploaded({
          skillsExtracted: 0,
          parseSuccess: false,
        });
      } finally {
        setUploading(false);
      }
    },
    [setResumeUploaded]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setRejectMessage(null);
      setSkipped(false);
      resumeSkipEventSentRef.current = false;
      setResumeFile(file);
      void runUpload(file);
    },
    [runUpload, setResumeFile]
  );

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    const first = fileRejections[0]?.errors[0]?.message;
    setRejectMessage(
      first ?? "Please use a PDF or DOCX under 5MB."
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPT,
    maxSize: MAX_BYTES,
    maxFiles: 1,
    multiple: false,
    disabled: uploading,
  });

  const handleSkip = useCallback(() => {
    abortRef.current?.abort();
    setSkipped(true);
    setResumeFile(null);
    setUploading(false);
    setUploadProgress(0);
    setParseFailed(false);
    setUploadError(null);
    setRejectMessage(null);
    resetUploadOutcome();
    if (!resumeSkipEventSentRef.current) {
      resumeSkipEventSentRef.current = true;
      trackOnboardingResumeSkipped();
    }
  }, [resetUploadOutcome, setResumeFile]);

  const uploadSucceeded = Boolean(resumeUrl && resumeParsed);
  const canContinue = uploadSucceeded || skipped;
  const blockedOnlyByExtra =
    canContinue && continueExtraDisabled && Boolean(continueBlockedHint);

  useEffect(() => {
    const skillCount =
      uploadSucceeded && resumeParsed
        ? skillsExtracted.length
        : null;
    onResumeDataChangeRef.current({ resumeUrl, resumeParsed, skillCount });
  }, [resumeUrl, resumeParsed, skillsExtracted, uploadSucceeded]);

  const displayFile = resumeFile;
  const skillCount = skillsExtracted.length;
  const visibleSkills = skillsExtracted.slice(0, 8);
  const moreCount = Math.max(0, skillCount - visibleSkills.length);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-zinc-600 bg-zinc-900/80 px-2.5 py-0.5 text-xs font-medium tracking-wide text-zinc-400 uppercase">
          Optional — skip anytime
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Upload your resume for a smarter roadmap
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          We extract your existing skills so your roadmap skips what you already
          know. Never shared. Deletable anytime.
        </p>
      </div>

      <div
        {...getRootProps({
          className: cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-600 bg-[#111] px-6 py-10 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
            isDragActive && "border-[#E5FF47]/70 bg-[#161616]",
            uploading && "pointer-events-none opacity-70"
          ),
        })}
      >
        <input {...getInputProps()} />
        <span className="flex size-12 items-center justify-center rounded-full border border-zinc-700 bg-[#161616] text-zinc-300">
          <FileUp className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-zinc-300">
          {isDragActive ? "Drop to upload" : "Drop your resume here"}
        </p>
        <p className="text-xs text-zinc-500">
          PDF or DOCX · max {formatFileSize(MAX_BYTES)}
        </p>
        <button
          type="button"
          disabled={uploading}
          className="text-sm font-medium text-[#E5FF47] underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-40"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          Browse files
        </button>
      </div>

      {rejectMessage ? (
        <p className="text-sm text-amber-400/90" role="alert">
          {rejectMessage}
        </p>
      ) : null}

      {displayFile ? (
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="truncate font-medium text-zinc-200">
              {displayFile.name}
            </span>
            <span className="shrink-0 text-zinc-500">
              {formatFileSize(displayFile.size)}
            </span>
          </div>
          {uploading ? (
            <div className="mt-1 flex flex-col gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-[#E5FF47] transition-[width] duration-150 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500">
                Uploading… {uploadProgress}%
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {parseFailed ? (
        <div className="flex flex-col gap-1" role="status">
          <p className="text-sm text-zinc-400">
            Resume couldn&apos;t be parsed — skip for now and add it later
          </p>
          {uploadError && uploadError !== "Upload failed" ? (
            <p className="text-xs text-zinc-500">{uploadError}</p>
          ) : null}
        </div>
      ) : null}

      {uploadSucceeded ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-zinc-200">
            ✓ Resume parsed. We found {skillCount}{" "}
            {skillCount === 1 ? "skill" : "skills"}.
          </p>
          {visibleSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {visibleSkills.map((s) => (
                <span
                  key={s}
                  className="inline-flex max-w-full truncate rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-xs text-zinc-300"
                >
                  {s}
                </span>
              ))}
              {moreCount > 0 ? (
                <span className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-xs text-zinc-500">
                  +{moreCount} more
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm text-zinc-500">
            Roadmap will skip {skillCount}{" "}
            {skillCount === 1 ? "existing skill" : "existing skills"} you already
            know
          </p>
        </div>
      ) : null}

      {!uploadSucceeded ? (
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            className="text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-200 hover:underline"
            onClick={handleSkip}
          >
            Skip this step →
          </button>
          {skipped ? (
            <p className="text-sm text-zinc-500">
              You can add your resume later from your profile
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            onClick={onBack}
          >
            Back
          </Button>
        ) : (
          <span aria-hidden className="hidden sm:block" />
        )}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          {blockedOnlyByExtra ? (
            <p className="text-right text-sm text-amber-400/90 sm:max-w-[280px]" role="status">
              {continueBlockedHint}
            </p>
          ) : null}
          <Button
            type="button"
            className="h-9 w-full bg-[#E5FF47] text-sm font-medium text-[#111] transition-[opacity,transform,box-shadow] duration-200 ease-out hover:bg-[#d8f542] hover:opacity-100 sm:ml-auto sm:min-w-[120px] sm:w-auto"
            disabled={!canContinue || continueExtraDisabled}
            onClick={() => void onContinue()}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
