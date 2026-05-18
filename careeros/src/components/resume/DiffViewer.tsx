"use client";

import type { DiffHunk } from "@/lib/resume/sectionRewriter";

export function DiffViewer({ diffHunks }: { diffHunks: DiffHunk[] }) {
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {diffHunks.map((hunk, index) => (
        <span
          key={`${hunk.type}-${index}`}
          className={
            hunk.type === "removed"
              ? "bg-red-50 text-red-700 line-through dark:bg-red-950/40 dark:text-red-300"
              : hunk.type === "added"
                ? "bg-green-50 text-green-700 underline dark:bg-green-950/40 dark:text-green-300"
                : "text-gray-700 dark:text-zinc-300"
          }
        >
          {hunk.text}
        </span>
      ))}
    </p>
  );
}
