"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { ATSScoreRing } from "@/components/resume/ATSScoreRing";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { VARIANT_TABS } from "@/components/resume/constants";
import type { ResumeVariantClient } from "@/components/resume/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ResumeAngle, TargetRole } from "@/lib/resume/types";

export function VariantTabs({
  variants,
  targetRole,
  onVariantRefresh,
}: {
  variants: ResumeVariantClient[];
  targetRole: TargetRole;
  onVariantRefresh: () => void;
}) {
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);

  const variantByAngle = Object.fromEntries(
    variants.map((v) => [v.angle, v])
  ) as Partial<Record<ResumeAngle, ResumeVariantClient>>;

  const defaultTab =
    VARIANT_TABS.find((t) => variantByAngle[t.angle])?.angle ??
    VARIANT_TABS[0].angle;

  async function handleExport(
    variantId: string,
    format: "pdf" | "docx"
  ) {
    setExporting(format);
    try {
      const res = await fetch(`/api/resume/variant/${variantId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const data = (await res.json()) as {
        pdfUrl?: string;
        docxUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Export failed");
      }
      const url = format === "pdf" ? data.pdfUrl : data.docxUrl;
      if (!url) {
        throw new Error("No download URL returned");
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Download failed"
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <Tabs defaultValue={defaultTab} className="w-full" key={defaultTab}>
      <TabsList className="w-full overflow-x-auto">
        {VARIANT_TABS.map((tab) => (
          <TabsTrigger key={tab.angle} value={tab.angle} disabled={!variantByAngle[tab.angle]}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {VARIANT_TABS.map((tab) => {
        const variant = variantByAngle[tab.angle];
        if (!variant) return null;

        return (
          <TabsContent key={tab.angle} value={tab.angle}>
            <div className="grid gap-6 lg:grid-cols-2">
              <ResumePreview
                variant={variant}
                targetRole={targetRole}
                onApplied={onVariantRefresh}
              />

              <div className="flex flex-col items-center gap-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
                <ATSScoreRing
                  score={variant.atsScore}
                  breakdown={variant.atsBreakdown}
                  targetRole={targetRole}
                  variantSkills={variant.generatedContent.skills}
                />

                <div className="flex w-full flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-zinc-700"
                    disabled={exporting !== null}
                    onClick={() => void handleExport(variant.id, "pdf")}
                  >
                    {exporting === "pdf" ? (
                      <Loader2Icon className="animate-spin" />
                    ) : null}
                    Download PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-zinc-700"
                    disabled={exporting !== null}
                    onClick={() => void handleExport(variant.id, "docx")}
                  >
                    {exporting === "docx" ? (
                      <Loader2Icon className="animate-spin" />
                    ) : null}
                    Download DOCX
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
