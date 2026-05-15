import type { CompletionChecklist } from "@/db/schema/roadmap";

export type ChecklistKey =
  | "deployedLink"
  | "githubRepo"
  | "loomDemo"
  | "writeUp";

export const CHECKLIST_KEYS: ChecklistKey[] = [
  "deployedLink",
  "githubRepo",
  "loomDemo",
  "writeUp",
];

export const CHECKLIST_LABELS: Record<ChecklistKey, string> = {
  deployedLink: "Deployed live link",
  githubRepo: "GitHub repository",
  loomDemo: "Loom demo video",
  writeUp: "Write-up / documentation",
};

export function parseCompletionChecklist(
  raw: CompletionChecklist
): Record<ChecklistKey, boolean> {
  return {
    deployedLink: Boolean(raw.deployedLink),
    githubRepo: Boolean(raw.githubRepo),
    loomDemo: Boolean(raw.loomDemo),
    writeUp: Boolean(raw.writeUp),
  };
}
