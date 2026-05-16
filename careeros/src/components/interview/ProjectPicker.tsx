"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { InterviewSetupProject } from "@/lib/getInterviewSetupForClerk";
import { cn } from "@/lib/utils";

const MAX_SELECTED = 3;

export type Project = InterviewSetupProject;

export type ProjectPickerProps = {
  projects: Project[];
  selected: string[];
  onChange: (ids: string[]) => void;
};

export function ProjectPicker({
  projects,
  selected,
  onChange,
}: ProjectPickerProps) {
  const atMax = selected.length >= MAX_SELECTED;

  const toggleProject = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
      return;
    }
    if (atMax) return;
    onChange([...selected, id]);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-zinc-300">Project context</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Optional — select up to {MAX_SELECTED} published projects (
          {selected.length}/{MAX_SELECTED} selected).
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          The AI interviewer will ask follow-up questions based on these
          projects.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-[#141414] px-4 py-8 text-center">
          <p className="text-sm text-zinc-400">No published projects yet</p>
          <p className="mt-1 text-xs text-zinc-600">
            Publish a proof-of-work project so the interviewer can reference your
            real work.
          </p>
          <Link
            href="/projects/new"
            className="mt-4 inline-flex text-sm font-medium text-[#E5FF47] hover:text-[#d8f542]"
          >
            Publish a project →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => {
            const isSelected = selected.includes(project.id);
            const disabled = !isSelected && atMax;

            return (
              <li key={project.id}>
                <label
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition-colors",
                    isSelected
                      ? "border-[#E5FF47]/50 bg-[#E5FF47]/5"
                      : "border-zinc-800 bg-[#1A1A1A] hover:border-zinc-700",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={disabled}
                    onCheckedChange={() => toggleProject(project.id)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">
                        {project.name}
                      </span>
                    </span>
                    {project.stack.length > 0 ? (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {project.stack.map((tag) => (
                          <Badge
                            key={`${project.id}-${tag}`}
                            variant="outline"
                            className="border-zinc-700 text-zinc-400"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    ) : null}
                    <span className="mt-2 block text-xs leading-relaxed text-zinc-500">
                      {project.description}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
