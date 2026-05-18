"use client";

import { useState } from "react";

import { SectionRewriteDrawer } from "@/components/resume/SectionRewriteDrawer";
import { SECTION_LABELS } from "@/components/resume/constants";
import { sectionTextFromContent } from "@/components/resume/resumeContent";
import type { ResumeVariantClient } from "@/components/resume/types";
import { Button } from "@/components/ui/button";
import type {
  GeneratedVariantContent,
  SectionName,
  TargetRole,
} from "@/lib/resume/types";
import { cn } from "@/lib/utils";

const PREVIEW_SECTIONS: SectionName[] = [
  "SUMMARY",
  "EXPERIENCE",
  "SKILLS",
  "PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS",
];

function hasSectionContent(
  sectionName: SectionName,
  content: GeneratedVariantContent
): boolean {
  return sectionTextFromContent(sectionName, content).trim().length > 0;
}

export function ResumePreview({
  variant,
  targetRole,
  onApplied,
}: {
  variant: ResumeVariantClient;
  targetRole: TargetRole;
  onApplied: () => void;
}) {
  const [rewriteSection, setRewriteSection] = useState<SectionName | null>(
    null
  );
  const content = variant.generatedContent;

  return (
    <>
      <div className="max-h-[min(70vh,720px)] space-y-4 overflow-y-auto rounded-xl bg-white p-5 text-zinc-900 shadow-lg dark:bg-zinc-50">
        {content.contact.name ? (
          <header className="border-b border-zinc-200 pb-3">
            <h2 className="text-lg font-semibold">{content.contact.name}</h2>
            <p className="text-xs text-zinc-600">
              {[
                content.contact.email,
                content.contact.phone,
                content.contact.location,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>
        ) : null}

        {PREVIEW_SECTIONS.map((sectionName) => {
          if (!hasSectionContent(sectionName, content)) return null;
          const text = sectionTextFromContent(sectionName, content);
          return (
            <section
              key={sectionName}
              className="group relative rounded-lg border border-transparent p-2 transition-colors hover:border-zinc-200"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {SECTION_LABELS[sectionName]}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 shrink-0 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100",
                    "text-[#6366F1] hover:bg-[#6366F1]/10 hover:text-[#6366F1]"
                  )}
                  onClick={() => setRewriteSection(sectionName)}
                >
                  Rewrite with AI →
                </Button>
              </div>
              <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-zinc-800">
                {text}
              </pre>
            </section>
          );
        })}
      </div>

      {rewriteSection ? (
        <SectionRewriteDrawer
          open
          onOpenChange={(open) => {
            if (!open) setRewriteSection(null);
          }}
          variantId={variant.id}
          sectionName={rewriteSection}
          originalText={sectionTextFromContent(
            rewriteSection,
            content
          )}
          targetRole={targetRole}
          onApplied={onApplied}
        />
      ) : null}
    </>
  );
}
