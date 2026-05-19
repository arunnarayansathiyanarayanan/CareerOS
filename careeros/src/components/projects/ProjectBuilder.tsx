"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  PlusIcon,
  Share2Icon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import Image from "next/image";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { SKILL_ONTOLOGY } from "@/constants/skill-ontology";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  TemplateSelector,
  templateToBuilderDefaults,
} from "@/components/projects/TemplateSelector";

const API_EMBED_TYPES = [
  "github",
  "loom",
  "youtube",
  "notion",
  "deployed_url",
  "screenshot",
  "pdf",
] as const;

type ApiEmbedType = (typeof API_EMBED_TYPES)[number];

const EMBED_LABEL: Record<ApiEmbedType, string> = {
  github: "GitHub",
  loom: "Loom",
  youtube: "YouTube",
  notion: "Notion",
  deployed_url: "Deployed URL",
  screenshot: "Screenshot",
  pdf: "PDF",
};

const LINK_TYPES = new Set<ApiEmbedType>([
  "github",
  "loom",
  "youtube",
  "notion",
  "deployed_url",
]);

const MAX_SCREENSHOTS = 10;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

const formSchema = z.object({
  title: z.string().min(1, "Required"),
  one_liner: z
    .string()
    .min(1, "Required")
    .max(100, "Max 100 characters"),
  problem_solved: z
    .string()
    .min(100, "Use at least 100 characters"),
  my_role: z.string().min(1, "Required"),
  outcome: z.string().min(1, "Required"),
  privacy_mode: z.enum(["public", "unlisted", "recruiter_share"]),
  ai_stack: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

type EmbedRow = {
  clientKey: string;
  embedType: ApiEmbedType;
  url: string;
  file: File | null;
  serverId: string | null;
  previewObjectUrl: string | null;
  remoteMediaUrl: string | null;
  lastUploadInfo: { name: string; size: number } | null;
  /** Last URL committed to the server for this row (link types). */
  committedUrl: string | null;
  syncError: string | null;
};

type ProjectJson = {
  id: string;
  title: string;
  one_liner: string;
  problem_solved: string;
  my_role: string;
  outcome: string;
  ai_stack: string[];
  privacy_mode: "public" | "unlisted" | "recruiter_share";
  username: string;
  slug: string;
};

type ReviewResult = {
  score: number;
  strengths: string[];
  improvements: string[];
  portfolio_ready: boolean;
};

function newRow(over?: Partial<EmbedRow>): EmbedRow {
  return {
    clientKey: crypto.randomUUID(),
    embedType: "github",
    url: "",
    file: null,
    serverId: null,
    previewObjectUrl: null,
    remoteMediaUrl: null,
    lastUploadInfo: null,
    committedUrl: null,
    syncError: null,
    ...over,
  };
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function sectionTitle(text: string) {
  return (
    <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
      {text}
    </h2>
  );
}

function cardClass() {
  return "rounded-xl border border-zinc-800 bg-[#1A1A1A] p-4 shadow-sm md:p-6";
}

/** Full share URL from API display form (host + path, no scheme). */
function toHttpsUrl(displayOrFull: string): string {
  const t = displayOrFull.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

function DragHandle({ controls }: { controls: ReturnType<typeof useDragControls> }) {
  return (
    <button
      type="button"
      aria-label="Reorder"
      className="touch-none rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
      onPointerDown={(e) => controls.start(e)}
    >
      <GripVerticalIcon className="size-4" />
    </button>
  );
}

function SkillCombobox({
  selected,
  onAdd,
}: {
  selected: string[];
  onAdd: (skill: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start border-zinc-700 bg-[#0A0A0A] text-zinc-200 hover:bg-zinc-900 sm:w-72"
        >
          Add skill…
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,22rem)] border-zinc-800 bg-[#1A1A1A] p-0 text-zinc-100"
        align="start"
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Search skills…"
            className="border-zinc-700 text-zinc-100"
          />
          <CommandList>
            <CommandEmpty className="text-zinc-500">No matches.</CommandEmpty>
            <CommandGroup>
              {SKILL_ONTOLOGY.map((skill) => (
                <CommandItem
                  key={skill}
                  value={skill}
                  disabled={selected.includes(skill)}
                  className="text-zinc-200 aria-selected:bg-zinc-800"
                  onSelect={() => {
                    onAdd(skill);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "size-4",
                      selected.includes(skill) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {skill}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function EmbedRowEditor({
  row,
  onChangeType,
  onUrlChange,
  onUrlBlur,
  onFileChange,
  onRemove,
}: {
  row: EmbedRow;
  onChangeType: (t: ApiEmbedType) => void;
  onUrlChange: (url: string) => void;
  onUrlBlur: () => void;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isLink = LINK_TYPES.has(row.embedType);

  return (
    <Reorder.Item
      value={row.clientKey}
      dragListener={false}
      dragControls={controls}
      className="rounded-xl border border-zinc-800 bg-[#0A0A0A] p-3 shadow-sm"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <DragHandle controls={controls} />
        <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,200px)_1fr]">
          <Select
            value={row.embedType}
            onValueChange={(v) => onChangeType(v as ApiEmbedType)}
          >
            <SelectTrigger className="w-full border-zinc-700 bg-[#1A1A1A] text-zinc-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-[#1A1A1A] text-zinc-100">
              {API_EMBED_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {EMBED_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-2">
            {isLink ? (
              <Input
                className="border-zinc-700 bg-[#1A1A1A] text-zinc-100 placeholder:text-zinc-600"
                placeholder="https://"
                value={row.url}
                onChange={(e) => onUrlChange(e.target.value)}
                onBlur={onUrlBlur}
              />
            ) : (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={
                    row.embedType === "pdf" ? "application/pdf" : "image/*"
                  }
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    onFileChange(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed border-zinc-600 text-zinc-300 sm:w-auto"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon className="size-4" />
                  {row.embedType === "pdf" ? "Choose PDF" : "Choose image"}
                </Button>
                {row.embedType === "screenshot" &&
                (row.previewObjectUrl || row.remoteMediaUrl) ? (
                  <Image
                    src={
                      (row.previewObjectUrl ||
                        row.remoteMediaUrl) as string
                    }
                    alt=""
                    width={320}
                    height={160}
                    unoptimized
                    className="mt-2 max-h-40 w-full max-w-xs rounded-lg border border-zinc-800 object-cover"
                  />
                ) : null}
                {row.embedType === "pdf" && row.lastUploadInfo ? (
                  <p className="text-sm text-zinc-400">
                    {row.lastUploadInfo.name} ·{" "}
                    {formatBytes(row.lastUploadInfo.size)}
                  </p>
                ) : null}
              </div>
            )}
            {row.syncError ? (
              <p className="text-sm text-red-400">{row.syncError}</p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-zinc-500 hover:text-red-400"
          aria-label="Remove embed"
          onClick={onRemove}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </Reorder.Item>
  );
}

export function ProjectBuilder() {
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const [draftLoading, setDraftLoading] = React.useState(true);
  const [savedLabel, setSavedLabel] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const [publishedDisplayUrl, setPublishedDisplayUrl] = React.useState<
    string | null
  >(null);
  const [publishedTitle, setPublishedTitle] = React.useState<string | null>(
    null
  );
  const [recruiterUrl, setRecruiterUrl] = React.useState<string | null>(null);
  const [recruiterBusy, setRecruiterBusy] = React.useState(false);
  const [recruiterError, setRecruiterError] = React.useState<string | null>(
    null
  );
  const [copied, setCopied] = React.useState(false);

  const [embedRows, setEmbedRows] = React.useState<EmbedRow[]>([]);
  const embedRowsRef = React.useRef(embedRows);
  React.useEffect(() => {
    embedRowsRef.current = embedRows;
  }, [embedRows]);
  const hasSyncedProofEmbed = embedRows.some((r) => r.serverId !== null);
  const reorderTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [aiResult, setAiResult] = React.useState<ReviewResult | null>(null);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      one_liner: "",
      problem_solved: "",
      my_role: "",
      outcome: "",
      privacy_mode: "unlisted",
      ai_stack: [],
    },
  });

  const watched = useWatch({ control: form.control });
  const autosaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setDraftLoading(true);
      setDraftError(null);
      try {
        const res = await fetch("/api/projects/draft", { method: "POST" });
        const data = (await res.json()) as {
          project?: ProjectJson;
          error?: string;
          code?: string;
        };
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Could not start draft"
          );
        }
        if (!data.project || cancelled) return;
        const p = data.project;
        setProjectId(p.id);
        form.reset({
          title: p.title,
          one_liner: p.one_liner,
          problem_solved: p.problem_solved,
          my_role: p.my_role,
          outcome: p.outcome,
          privacy_mode: p.privacy_mode,
          ai_stack: p.ai_stack ?? [],
        });
      } catch (e) {
        if (!cancelled) {
          setDraftError(e instanceof Error ? e.message : "Draft failed");
        }
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form]);

  const patchDraft = React.useCallback(
    async (values: FormValues) => {
      if (!projectId) return;
      const body: Record<string, unknown> = {};
      if (values.title.trim()) body.title = values.title.trim();
      if (values.one_liner.trim()) {
        body.one_liner = values.one_liner.trim();
      }
      if (values.problem_solved.trim().length >= 100) {
        body.problem_solved = values.problem_solved.trim();
      }
      if (values.my_role.trim()) body.my_role = values.my_role.trim();
      if (values.outcome.trim()) body.outcome = values.outcome.trim();
      body.privacy_mode = values.privacy_mode;
      body.ai_stack = values.ai_stack;

      if (Object.keys(body).length === 0) return;

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(
          typeof j.error === "string" ? j.error : "Save failed"
        );
      }
      setSavedLabel("Saved just now");
      setSaveError(null);
    },
    [projectId]
  );

  const flushSave = React.useCallback(async () => {
    const values = form.getValues();
    try {
      await patchDraft(values);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }, [form, patchDraft]);

  React.useEffect(() => {
    if (draftLoading || !projectId || publishedDisplayUrl) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void flushSave();
    }, 10_000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [watched, draftLoading, projectId, publishedDisplayUrl, flushSave]);

  const scheduleReorder = React.useCallback(
    (rows: EmbedRow[]) => {
      const ids = rows.map((r) => r.serverId).filter(Boolean) as string[];
      if (ids.length === 0 || !projectId) return;
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      reorderTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/projects/${projectId}/embeds/reorder`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ordered_embed_ids: ids }),
            }
          );
          if (!res.ok) {
            const j = (await res.json()) as { error?: string };
            console.warn(j.error ?? "reorder failed");
          }
        } catch (e) {
          console.warn(e);
        }
      }, 400);
    },
    [projectId]
  );

  async function deleteServerEmbed(row: EmbedRow) {
    if (!projectId || !row.serverId) return;
    await fetch(
      `/api/projects/${projectId}/embeds/${row.serverId}`,
      { method: "DELETE" }
    );
  }

  async function syncLinkRow(row: EmbedRow, url: string): Promise<EmbedRow> {
    if (!projectId) {
      return { ...row, syncError: "Draft not ready" };
    }
    const trimmed = url.trim();
    if (!isValidHttpUrl(trimmed)) {
      return { ...row, syncError: "Enter a valid http(s) URL" };
    }

    let next = { ...row, syncError: null as string | null };

    if (row.serverId && row.committedUrl && row.committedUrl !== trimmed) {
      await deleteServerEmbed(row);
      next = {
        ...next,
        serverId: null,
        committedUrl: null,
      };
    }

    if (next.serverId && next.committedUrl === trimmed) {
      return next;
    }

    const res = await fetch(`/api/projects/${projectId}/embeds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: next.embedType, url: trimmed }),
    });
    const data = (await res.json()) as {
      embed?: { id: string };
      error?: string;
    };
    if (!res.ok) {
      return {
        ...next,
        syncError:
          typeof data.error === "string" ? data.error : "Could not save link",
      };
    }
    const id = data.embed?.id;
    if (!id) {
      return { ...next, syncError: "Invalid server response" };
    }
    return {
      ...next,
      serverId: id,
      committedUrl: trimmed,
      remoteMediaUrl: null,
      lastUploadInfo: null,
    };
  }

  async function syncFileRow(row: EmbedRow, file: File): Promise<EmbedRow> {
    if (!projectId) {
      return { ...row, syncError: "Draft not ready" };
    }
    if (row.serverId) {
      await deleteServerEmbed(row);
    }
    const fd = new FormData();
    fd.set("type", row.embedType);
    fd.set("file", file);
    const res = await fetch(`/api/projects/${projectId}/embeds`, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json()) as {
      embed?: { id: string; url?: string | null };
      error?: string;
    };
    if (!res.ok) {
      return {
        ...row,
        serverId: null,
        syncError:
          typeof data.error === "string" ? data.error : "Upload failed",
      };
    }
    const id = data.embed?.id;
    if (!id) {
      return { ...row, serverId: null, syncError: "Invalid server response" };
    }
    return {
      ...row,
      serverId: id,
      syncError: null,
      committedUrl: null,
      remoteMediaUrl:
        typeof data.embed?.url === "string" ? data.embed.url : null,
      lastUploadInfo:
        row.embedType === "pdf"
          ? { name: file.name, size: file.size }
          : null,
    };
  }

  function updateRow(clientKey: string, patch: Partial<EmbedRow>) {
    setEmbedRows((prev) =>
      prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r))
    );
  }

  async function handleUrlBlur(clientKey: string) {
    const row = embedRowsRef.current.find((r) => r.clientKey === clientKey);
    if (!row) return;
    if (!LINK_TYPES.has(row.embedType)) return;
    const trimmed = row.url.trim();
    if (!trimmed) {
      if (row.serverId) {
        await deleteServerEmbed(row);
        updateRow(row.clientKey, {
          serverId: null,
          committedUrl: null,
          syncError: null,
        });
      }
      return;
    }
    const next = await syncLinkRow(row, trimmed);
    updateRow(row.clientKey, next);
    if (!next.syncError) {
      setEmbedRows((prev) => {
        const mapped = prev.map((r) => (r.clientKey === clientKey ? next : r));
        const ids = mapped
          .map((r) => r.serverId)
          .filter(Boolean) as string[];
        if (ids.length > 0 && projectId) {
          if (reorderTimer.current) clearTimeout(reorderTimer.current);
          reorderTimer.current = setTimeout(async () => {
            try {
              await fetch(`/api/projects/${projectId}/embeds/reorder`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ordered_embed_ids: ids }),
              });
            } catch {
              /* ignore */
            }
          }, 400);
        }
        return mapped;
      });
    }
  }

  async function handleFileChange(clientKey: string, file: File | null) {
    const row = embedRowsRef.current.find((r) => r.clientKey === clientKey);
    if (!row) return;

    if (!file) {
      updateRow(row.clientKey, {
        file: null,
        previewObjectUrl: null,
        syncError: null,
      });
      return;
    }

    if (row.embedType === "pdf" && file.size > MAX_PDF_BYTES) {
      updateRow(row.clientKey, {
        syncError: "PDF must be 25 MB or smaller",
        file: null,
      });
      return;
    }

    const prevShotCount = embedRowsRef.current.filter(
      (r) =>
        r.embedType === "screenshot" &&
        (r.serverId !== null || r.file !== null) &&
        r.clientKey !== clientKey
    ).length;
    if (row.embedType === "screenshot" && prevShotCount >= MAX_SCREENSHOTS) {
      updateRow(row.clientKey, {
        syncError: `Max ${MAX_SCREENSHOTS} screenshots`,
        file: null,
      });
      return;
    }

    let previewObjectUrl: string | null = null;
    if (row.embedType === "screenshot") {
      previewObjectUrl = URL.createObjectURL(file);
    }

    updateRow(row.clientKey, {
      file,
      previewObjectUrl,
      syncError: null,
    });

    const staged = {
      ...row,
      file,
      previewObjectUrl,
      syncError: null as string | null,
    };
    const next = await syncFileRow(staged, file);

    if (next.syncError) {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      updateRow(row.clientKey, {
        ...next,
        file: null,
        previewObjectUrl: null,
      });
      return;
    }

    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    updateRow(row.clientKey, {
      ...next,
      file: null,
      previewObjectUrl: null,
    });

    setEmbedRows((prev) => {
      const mapped = prev.map((r) =>
        r.clientKey === clientKey
          ? { ...next, file: null, previewObjectUrl: null }
          : r
      );
      const ids = mapped.map((r) => r.serverId).filter(Boolean) as string[];
      if (ids.length > 0 && projectId) {
        if (reorderTimer.current) clearTimeout(reorderTimer.current);
        reorderTimer.current = setTimeout(async () => {
          try {
            await fetch(`/api/projects/${projectId}/embeds/reorder`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ordered_embed_ids: ids }),
            });
          } catch {
            /* ignore */
          }
        }, 400);
      }
      return mapped;
    });
  }

  async function removeRow(row: EmbedRow) {
    if (row.previewObjectUrl) {
      URL.revokeObjectURL(row.previewObjectUrl);
    }
    if (row.serverId) {
      await deleteServerEmbed(row);
    }
    setEmbedRows((prev) => prev.filter((r) => r.clientKey !== row.clientKey));
  }

  async function changeRowType(row: EmbedRow, t: ApiEmbedType) {
    if (row.serverId) {
      await deleteServerEmbed(row);
    }
    if (row.previewObjectUrl) {
      URL.revokeObjectURL(row.previewObjectUrl);
    }
    updateRow(row.clientKey, {
      embedType: t,
      url: "",
      file: null,
      serverId: null,
      previewObjectUrl: null,
      remoteMediaUrl: null,
      lastUploadInfo: null,
      committedUrl: null,
      syncError: null,
    });
  }

  function onReorder(next: EmbedRow[]) {
    setEmbedRows(next);
    scheduleReorder(next);
  }

  async function runAiReview() {
    if (!projectId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/review`, {
        method: "POST",
      });
      const data = (await res.json()) as ReviewResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Review could not run"
        );
      }
      setAiResult({
        score: data.score,
        strengths: data.strengths,
        improvements: data.improvements,
        portfolio_ready: data.portfolio_ready,
      });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function onPublish() {
    setPublishError(null);
    const ok = await form.trigger();
    if (!ok) {
      setPublishError("Fix the highlighted fields before publishing.");
      return;
    }
    if (!projectId) {
      setPublishError("Draft not ready yet.");
      return;
    }

    const v = form.getValues();
    const body = {
      draft_project_id: projectId,
      title: v.title.trim(),
      one_liner: v.one_liner.trim(),
      problem_solved: v.problem_solved.trim(),
      ai_stack: v.ai_stack,
      my_role: v.my_role.trim(),
      outcome: v.outcome.trim(),
      privacy_mode: v.privacy_mode,
    };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        public_url?: string;
        error?: string;
        fields?: unknown;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Publish failed"
        );
      }
      if (data.public_url) {
        setPublishedDisplayUrl(data.public_url);
        setPublishedTitle(v.title.trim());
      }
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Publish failed");
    }
  }

  async function generateRecruiterLink() {
    if (!projectId) return;
    setRecruiterBusy(true);
    setRecruiterError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/recruiter-share`, {
        method: "POST",
      });
      const data = (await res.json()) as { share_url?: string; error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not generate link"
        );
      }
      if (data.share_url) {
        setRecruiterUrl(data.share_url);
      }
    } catch (e) {
      setRecruiterError(
        e instanceof Error ? e.message : "Could not generate link"
      );
    } finally {
      setRecruiterBusy(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const publicShareUrl =
    publishedDisplayUrl != null
      ? toHttpsUrl(publishedDisplayUrl)
      : null;

  const shareEncoded = publicShareUrl
    ? encodeURIComponent(publicShareUrl)
    : "";
  const titleEnc =
    publishedTitle != null
      ? encodeURIComponent(publishedTitle)
      : "";

  if (draftLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-2/3 bg-zinc-800" />
        <Skeleton className="h-48 w-full bg-zinc-800" />
        <Skeleton className="h-48 w-full bg-zinc-800" />
      </div>
    );
  }

  if (draftError) {
    return (
      <div
        className={cn(
          "mx-auto max-w-lg rounded-xl border border-red-500/40 bg-red-950/30 p-6 text-red-200"
        )}
      >
        <p className="font-medium">Could not open the project builder</p>
        <p className="mt-2 text-sm opacity-90">{draftError}</p>
      </div>
    );
  }

  return (
    <>
    <div className="relative mx-auto max-w-3xl space-y-8 md:space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              New project
            </h1>
            {savedLabel && !publishedDisplayUrl ? (
              <span className="text-xs text-zinc-500">{savedLabel}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Build your proof-of-work, then publish when you are ready.
          </p>
        </div>
      </div>

      {saveError ? (
        <p className="text-sm text-red-400" role="alert">
          {saveError}
        </p>
      ) : null}

      {publishedDisplayUrl ? (
        <div className="space-y-4 rounded-xl border border-indigo-500/40 bg-indigo-950/25 p-5 md:p-6">
          <p className="text-center text-lg font-semibold text-white">
            Your project is live 🎉
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-700 bg-[#0A0A0A] px-3 py-2">
              <span className="truncate text-sm text-zinc-300">
                {publicShareUrl}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-zinc-600"
                onClick={() =>
                  publicShareUrl && void copyText(publicShareUrl)
                }
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-zinc-600"
              asChild
            >
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareEncoded}`}
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-zinc-600"
              asChild
            >
              <a
                href={`https://twitter.com/intent/tweet?url=${shareEncoded}&text=${titleEnc}`}
                target="_blank"
                rel="noreferrer"
              >
                X / Twitter
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-zinc-600"
              asChild
            >
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${publishedTitle ?? ""} ${publicShareUrl ?? ""}`.trim())}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </Button>
          </div>
          <div className="border-t border-zinc-800 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full border border-zinc-700 bg-zinc-800 text-zinc-100 sm:w-auto"
              disabled={recruiterBusy}
              onClick={() => void generateRecruiterLink()}
            >
              {recruiterBusy ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <Share2Icon className="size-4" />
              )}
              Generate Recruiter Share Link
            </Button>
            {recruiterError ? (
              <p className="mt-2 text-sm text-red-400">{recruiterError}</p>
            ) : null}
            {recruiterUrl ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-[#0A0A0A] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                  {toHttpsUrl(recruiterUrl)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-zinc-600"
                  onClick={() => void copyText(toHttpsUrl(recruiterUrl))}
                >
                  Copy link
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={!!publishedDisplayUrl}
          className="border-zinc-600 text-zinc-200"
          onClick={() => setTemplatesOpen(true)}
        >
          <LayoutTemplateIcon className="size-4" />
          Browse templates
        </Button>
      </div>

      {/* BASICS */}
      <section className={cardClass()}>
        <div className="mb-5 flex items-center justify-between gap-4">
          {sectionTitle("Basics")}
        </div>
        <div className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="title"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              Title
            </label>
            <Input
              id="title"
              className="border-zinc-700 bg-[#0A0A0A] text-zinc-100 placeholder:text-zinc-600"
              placeholder="Project name"
              {...form.register("title")}
              aria-invalid={!!form.formState.errors.title}
            />
            {form.formState.errors.title ? (
              <p className="mt-1.5 text-sm text-red-400">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-1.5 flex justify-between">
              <label
                htmlFor="one_liner"
                className="text-sm font-medium text-zinc-300"
              >
                One-liner
              </label>
              <span className="text-xs text-zinc-500">
                {(form.watch("one_liner") ?? "").length}/100
              </span>
            </div>
            <Input
              id="one_liner"
              maxLength={100}
              className="border-zinc-700 bg-[#0A0A0A] text-zinc-100 placeholder:text-zinc-600"
              placeholder="A single memorable sentence"
              {...form.register("one_liner")}
              aria-invalid={!!form.formState.errors.one_liner}
            />
            {form.formState.errors.one_liner ? (
              <p className="mt-1.5 text-sm text-red-400">
                {form.formState.errors.one_liner.message}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-1.5 flex justify-between">
              <label
                htmlFor="problem_solved"
                className="text-sm font-medium text-zinc-300"
              >
                Problem solved
              </label>
              <span className="text-xs text-zinc-500">
                {(form.watch("problem_solved") ?? "").length} chars (min 100)
              </span>
            </div>
            <Textarea
              id="problem_solved"
              rows={5}
              className="min-h-32 border-zinc-700 bg-[#0A0A0A] text-zinc-100 placeholder:text-zinc-600"
              placeholder="What problem did you tackle, and for whom?"
              {...form.register("problem_solved")}
              aria-invalid={!!form.formState.errors.problem_solved}
            />
            {form.formState.errors.problem_solved ? (
              <p className="mt-1.5 text-sm text-red-400">
                {form.formState.errors.problem_solved.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="my_role"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              My role
            </label>
            <Input
              id="my_role"
              className="border-zinc-700 bg-[#0A0A0A] text-zinc-100 placeholder:text-zinc-600"
              placeholder="e.g. Product engineer, solo builder, team lead"
              {...form.register("my_role")}
              aria-invalid={!!form.formState.errors.my_role}
            />
            {form.formState.errors.my_role ? (
              <p className="mt-1.5 text-sm text-red-400">
                {form.formState.errors.my_role.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="outcome"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              Outcome
            </label>
            <Textarea
              id="outcome"
              rows={4}
              className="min-h-24 border-zinc-700 bg-[#0A0A0A] text-zinc-100 placeholder:text-zinc-600"
              placeholder="What was the measurable result?"
              {...form.register("outcome")}
              aria-invalid={!!form.formState.errors.outcome}
            />
            {form.formState.errors.outcome ? (
              <p className="mt-1.5 text-sm text-red-400">
                {form.formState.errors.outcome.message}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* TECH */}
      <section className={cardClass()}>
        {sectionTitle("Tech stack")}
        <p className="mb-4 text-sm text-zinc-500">
          Select skills from the Aihired ontology; they power tagging and validation.
        </p>
        <Controller
          name="ai_stack"
          control={form.control}
          render={({ field }) => (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {field.value.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="gap-1 border border-zinc-700 bg-zinc-900/80 pl-2 text-zinc-200"
                  >
                    {skill}
                    <button
                      type="button"
                      className="rounded-md p-0.5 hover:bg-zinc-800"
                      aria-label={`Remove ${skill}`}
                      onClick={() =>
                        field.onChange(field.value.filter((s) => s !== skill))
                      }
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <SkillCombobox
                selected={field.value}
                onAdd={(s) =>
                  field.value.includes(s)
                    ? undefined
                    : field.onChange([...field.value, s])
                }
              />
            </div>
          )}
        />
      </section>

      {/* EMBEDS */}
      <section className={cardClass()}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {sectionTitle("Embeds")}
          <span className="text-xs text-zinc-500">
            Drag to reorder · max {MAX_SCREENSHOTS} screenshots · PDFs max{" "}
            {formatBytes(MAX_PDF_BYTES)}
          </span>
        </div>

        <Reorder.Group
          axis="y"
          values={embedRows.map((r) => r.clientKey)}
          onReorder={(keys) => {
            const map = new Map(embedRows.map((r) => [r.clientKey, r]));
            const next = keys
              .map((k) => map.get(k))
              .filter((r): r is EmbedRow => r !== undefined);
            onReorder(next);
          }}
          className="flex flex-col gap-3"
        >
          {embedRows.map((row) => (
            <EmbedRowEditor
              key={row.clientKey}
              row={row}
              onChangeType={(t) => void changeRowType(row, t)}
              onUrlChange={(url) => updateRow(row.clientKey, { url })}
              onUrlBlur={() => void handleUrlBlur(row.clientKey)}
              onFileChange={(f) => void handleFileChange(row.clientKey, f)}
              onRemove={() => void removeRow(row)}
            />
          ))}
        </Reorder.Group>

        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full border-dashed border-zinc-600 text-zinc-300 sm:w-auto"
          onClick={() => setEmbedRows((prev) => [...prev, newRow()])}
        >
          <PlusIcon className="size-4" />
          Add embed
        </Button>
      </section>

      {/* AI */}
      <section className={cardClass()}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setAiOpen((o) => !o)}
          aria-expanded={aiOpen}
        >
          <div className="flex items-center gap-2">
            {aiOpen ? (
              <ChevronDownIcon className="size-5 text-zinc-500" />
            ) : (
              <ChevronRightIcon className="size-5 text-zinc-500" />
            )}
            {sectionTitle("AI reviewer")}
          </div>
          <span className="text-xs text-zinc-500">Needs proof embeds</span>
        </button>

        {aiOpen ? (
          <div className="mt-5 space-y-4 border-t border-zinc-800 pt-5">
            <p className="text-sm text-zinc-400">
              Runs against your saved draft and your proof-of-work embeds (repo, demo,
              Loom, uploads). Add and save at least one embed above first—max 3 runs per
              project unless you change the stack.
            </p>
            {!hasSyncedProofEmbed ? (
              <p className="text-sm text-amber-400/90">
                Save a link (blur the URL field) or upload a file on an embed row to
                unlock the reviewer.
              </p>
            ) : null}
            <Button
              type="button"
              className="bg-[#6366F1] text-white hover:bg-[#5558E3]"
              disabled={aiLoading || !projectId || !hasSyncedProofEmbed}
              onClick={() => void runAiReview()}
            >
              {aiLoading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              Run AI Review
            </Button>
            {aiError ? (
              <p className="text-sm text-red-400">{aiError}</p>
            ) : null}

            {aiLoading ? (
              <div className="space-y-3 rounded-lg border border-zinc-800 bg-[#0A0A0A] p-4">
                <Skeleton className="h-8 w-20 bg-zinc-800" />
                <Skeleton className="h-4 w-full bg-zinc-800" />
                <Skeleton className="h-4 w-full bg-zinc-800" />
                <Skeleton className="h-4 w-2/3 bg-zinc-800" />
              </div>
            ) : null}

            {aiResult && !aiLoading ? (
              <div className="space-y-4 rounded-lg border border-zinc-800 bg-[#0A0A0A] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-[#6366F1] text-white hover:bg-[#6366F1]">
                    Score {aiResult.score}/10
                  </Badge>
                  {aiResult.portfolio_ready ? (
                    <Badge
                      variant="secondary"
                      className="border border-emerald-700/50 bg-emerald-950/50 text-emerald-200"
                    >
                      Portfolio-ready
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="border border-zinc-700 bg-zinc-900 text-zinc-400"
                    >
                      Needs polish
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-emerald-400">
                    Strengths
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">
                    {aiResult.strengths.map((s, i) => (
                      <li key={`${i}-${s.slice(0, 24)}`}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-amber-400">
                    Improvements
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">
                    {aiResult.improvements.map((s, i) => (
                      <li key={`${i}-${s.slice(0, 24)}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {publishError ? (
        <p className="text-sm text-red-400" role="alert">
          {publishError}
        </p>
      ) : null}

      {/* Sticky actions */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-[#1A1A1A]/95 px-4 py-3 backdrop-blur-md md:px-6",
          "pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Controller
            name="privacy_mode"
            control={form.control}
            render={({ field }) => (
              <div
                className="flex w-full rounded-lg border border-zinc-700 bg-[#0A0A0A] p-1 md:max-w-md"
                role="group"
                aria-label="Privacy"
              >
                {(
                  [
                    { v: "public" as const, label: "Public" },
                    { v: "unlisted" as const, label: "Unlisted" },
                    { v: "recruiter_share" as const, label: "Recruiter share" },
                  ] as const
                ).map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    title={
                      v === "recruiter_share"
                        ? "Recruiter share — link-friendly visibility"
                        : undefined
                    }
                    className={cn(
                      "flex-1 rounded-md px-2 py-2 text-center text-xs font-medium transition-colors sm:text-sm",
                      field.value === v
                        ? "bg-[#6366F1] text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    )}
                    onClick={() => field.onChange(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          />
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600 text-zinc-200"
              disabled={!!publishedDisplayUrl}
              onClick={() => void flushSave()}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              disabled={!!publishedDisplayUrl}
              className="bg-[#6366F1] text-white hover:bg-[#5558E3] disabled:opacity-50"
              onClick={() => void onPublish()}
            >
              Publish
            </Button>
          </div>
        </div>
      </div>
    </div>

    <AnimatePresence>
      {templatesOpen ? (
        <>
          <motion.button
            type="button"
            key="templates-backdrop"
            aria-label="Close templates"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[44] bg-black/65 backdrop-blur-[1px]"
            onClick={() => setTemplatesOpen(false)}
          />
          <motion.div
            key="templates-panel"
            role="dialog"
            aria-modal="true"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[50] flex w-full max-w-md shadow-2xl"
          >
            <TemplateSelector
              open={templatesOpen}
              className="w-full"
              onClose={() => setTemplatesOpen(false)}
              onSelectTemplate={(t) => {
                const privacy = form.getValues("privacy_mode");
                const next = templateToBuilderDefaults(t);
                form.reset({
                  ...next,
                  privacy_mode: privacy,
                });
                queueMicrotask(() => void flushSave());
              }}
            />
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
    </>
  );
}
