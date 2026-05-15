"use client";

import { Loader2Icon, SparklesIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TemplateCardPayload = {
  id: string;
  title: string | null;
  description: string | null;
  problem_statement: string | null;
  recommended_stack: string[];
  success_criteria: string | null;
};

type Props = {
  open: boolean;
  className?: string;
  onClose: () => void;
  onSelectTemplate: (template: TemplateCardPayload) => void;
};

function padProblemSolved(raw: string): string {
  const t = raw.trim();
  if (t.length >= 100) return t;
  const suffix =
    "\n\n(Flesh this out with users, constraints, metrics, and what you shipped — templates need 100+ characters to publish.)";
  return (t + suffix).trim();
}

/** Exported helper for applying template fields consistently with publish validation. */
export function templateToBuilderDefaults(t: TemplateCardPayload): {
  title: string;
  one_liner: string;
  problem_solved: string;
  outcome: string;
  ai_stack: string[];
  my_role: string;
} {
  const desc = (t.description ?? "").trim();
  const one = desc.length > 0 ? desc.slice(0, 100) : "Edit your one-liner";
  const problem =
    padProblemSolved(
      (t.problem_statement ?? "").trim().length > 0
        ? (t.problem_statement ?? "").trim()
        : desc
    );
  const outcomeRaw = (t.success_criteria ?? "").trim();
  const outcome =
    outcomeRaw.length > 0
      ? outcomeRaw
      : desc.length > 0
        ? desc.slice(0, 280)
        : "Describe the measurable outcome.";

  return {
    title: (t.title ?? "").trim() || "Untitled project",
    one_liner: one,
    problem_solved: problem,
    outcome,
    ai_stack: Array.isArray(t.recommended_stack) ? [...t.recommended_stack] : [],
    my_role: "Your role on this project (edit)",
  };
}

export function TemplateSelector({
  open,
  className,
  onClose,
  onSelectTemplate,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<TemplateCardPayload[]>([]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const progressRes = await fetch("/api/onboarding/progress");
        const progressJson = (await progressRes.json()) as {
          profile?: { targetRole?: string | null } | null;
        };
        const role =
          progressRes.ok &&
          progressJson.profile?.targetRole &&
          progressJson.profile.targetRole.length > 0
            ? progressJson.profile.targetRole
            : undefined;

        const qs =
          role !== undefined
            ? `?role=${encodeURIComponent(role)}`
            : "";
        let res = await fetch(`/api/projects/templates${qs}`);
        let data = (await res.json()) as {
          templates?: TemplateCardPayload[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Could not load templates"
          );
        }
        let list = data.templates ?? [];
        if (list.length === 0 && role !== undefined) {
          res = await fetch("/api/projects/templates");
          data = (await res.json()) as {
            templates?: TemplateCardPayload[];
            error?: string;
          };
          if (res.ok) {
            list = data.templates ?? [];
          }
        }
        if (!cancelled) {
          setTemplates(list);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load templates");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <aside
      className={cn(
        "flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-[#111111] shadow-2xl",
        className
      )}
      aria-label="Project templates"
    >
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-4 md:px-5">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <SparklesIcon className="size-4 text-indigo-400" />
            Start from template
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Prefills your draft — you can edit everything before publishing.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          aria-label="Close templates"
          onClick={onClose}
        >
          <XIcon className="size-5" />
        </Button>
      </div>

      <div className="border-b border-zinc-800 px-4 py-3 md:px-5">
        <Button
          type="button"
          variant="outline"
          className="w-full border-zinc-700 bg-[#0A0A0A] text-zinc-100 hover:bg-zinc-900"
          onClick={onClose}
        >
          Start from scratch
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-3 px-4 py-4 md:px-5">
          {loading ? (
            <div className="flex items-center gap-2 py-16 text-sm text-zinc-400">
              <Loader2Icon className="size-4 animate-spin" />
              Loading templates…
            </div>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          {!loading && !error && templates.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              No templates for your role yet. Try again without filtering, or start
              from scratch.
            </p>
          ) : null}
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="w-full rounded-xl border border-zinc-800 bg-[#0A0A0A] p-4 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-900/80"
              onClick={() => {
                onSelectTemplate(t);
                onClose();
              }}
            >
              <p className="font-medium text-zinc-100">
                {t.title?.trim() || "Untitled template"}
              </p>
              {t.description?.trim() ? (
                <p className="mt-2 line-clamp-3 text-sm text-zinc-400">
                  {t.description.trim()}
                </p>
              ) : null}
              {t.recommended_stack.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.recommended_stack.slice(0, 8).map((s) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="border border-zinc-700 bg-zinc-900/90 text-xs font-normal text-zinc-300"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
