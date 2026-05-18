"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { GenerationSkeleton } from "@/components/resume/GenerationSkeleton";
import { UploadZone } from "@/components/resume/UploadZone";
import { VariantTabs } from "@/components/resume/VariantTabs";
import { VersionHistory } from "@/components/resume/VersionHistory";
import type { ResumeVariantClient } from "@/components/resume/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { TargetRole } from "@/lib/resume/types";

export function ResumeOptimizerShell() {
  const [uploadedVariants, setUploadedVariants] = useState<
    ResumeVariantClient[] | null
  >(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null
  );
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<TargetRole | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);

  const handleReset = useCallback(() => {
    setUploadedVariants(null);
    setSelectedVersionId(null);
    setResumeId(null);
    setTargetRole(null);
    setIsGenerating(false);
    setGenerationError(null);
  }, []);

  const loadVariantsForVersion = useCallback(async (versionId: string) => {
    setLoadingVersion(true);
    try {
      const res = await fetch(`/api/resume/versions/${versionId}/variants`);
      const data = (await res.json()) as {
        variants?: ResumeVariantClient[];
        version?: { targetRole: TargetRole };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load version");
      }
      if (!data.variants?.length) {
        toast.error("No variants found for this version");
        return;
      }
      setUploadedVariants(
        data.variants.map((v) => ({
          ...v,
          createdAt:
            typeof v.createdAt === "string"
              ? v.createdAt
              : new Date(v.createdAt as unknown as string).toISOString(),
        }))
      );
      setSelectedVersionId(versionId);
      if (data.version?.targetRole) {
        setTargetRole(data.version.targetRole);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load version"
      );
    } finally {
      setLoadingVersion(false);
    }
  }, []);

  const refreshCurrentVariants = useCallback(() => {
    if (selectedVersionId) {
      void loadVariantsForVersion(selectedVersionId);
    }
  }, [loadVariantsForVersion, selectedVersionId]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
          Resume Optimizer
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Upload your resume, pick a target role, and get three ATS-optimized
          positioning variants.
        </p>
      </header>

      {generationError && !isGenerating ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{generationError}</span>
            <Button type="button" variant="outline" size="sm" onClick={handleReset}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isGenerating ? (
        <GenerationSkeleton />
      ) : uploadedVariants && targetRole ? (
        <div className={loadingVersion ? "pointer-events-none opacity-60" : ""}>
          <VariantTabs
            variants={uploadedVariants}
            targetRole={targetRole}
            onVariantRefresh={refreshCurrentVariants}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <p className="text-center text-sm text-gray-400">
            Upload your resume to get started
          </p>
          <UploadZone
            onResumeCreated={(meta) => {
              setResumeId(meta.resumeId);
              setSelectedVersionId(meta.versionId);
              setTargetRole(meta.targetRole);
            }}
            onVariantsReady={(variants, meta) => {
              setUploadedVariants(variants);
              setSelectedVersionId(meta.versionId);
              setResumeId(meta.resumeId);
              setTargetRole(meta.targetRole);
              setGenerationError(null);
            }}
            onGeneratingChange={setIsGenerating}
            onGenerationError={setGenerationError}
            disabled={loadingVersion}
          />
        </div>
      )}

      {resumeId && selectedVersionId ? (
        <VersionHistory
          resumeId={resumeId}
          currentVersionId={selectedVersionId}
          onVersionSelect={(versionId) => void loadVariantsForVersion(versionId)}
        />
      ) : null}
    </div>
  );
}
