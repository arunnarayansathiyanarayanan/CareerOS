"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const MAX_CONTENT = 2000;
const MAX_SKILLS = 10;

export type PostComposerProps = {
  cohortId?: string;
  onPost?: () => void;
};

function resizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function PostComposer({ cohortId, onPost }: PostComposerProps) {
  const utils = api.useUtils();
  const [content, setContent] = React.useState("");
  const [skills, setSkills] = React.useState<string[]>([]);
  const [skillInput, setSkillInput] = React.useState("");
  const [projectQuery, setProjectQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [linkedProject, setLinkedProject] = React.useState<{
    id: string;
    title: string;
    slug: string;
  } | null>(null);
  const [projectDropdownOpen, setProjectDropdownOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(projectQuery.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [projectQuery]);

  const { data: projectResults, isFetching: isSearchingProjects } =
    api.project.search.useQuery(
      { q: debouncedQuery },
      { enabled: debouncedQuery.length > 0 && !linkedProject },
    );

  const createPost = api.community.post.create.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: async () => {
      setContent("");
      setSkills([]);
      setSkillInput("");
      setProjectQuery("");
      setLinkedProject(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      await utils.community.post.getFeed.invalidate();
      onPost?.();
    },
  });

  const charCount = content.length;
  const isNearLimit = charCount > 1900;
  const canSubmit = content.trim().length > 0 && !createPost.isPending;

  function addSkill(raw: string) {
    const value = raw.trim();
    if (!value || skills.length >= MAX_SKILLS) return;
    if (skills.some((s) => s.toLowerCase() === value.toLowerCase())) return;
    setSkills((prev) => [...prev, value]);
    setSkillInput("");
  }

  function handleSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill(skillInput);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    createPost.mutate({
      content: content.trim(),
      cohortId,
      linkedProjectId: linkedProject?.id,
      taggedSkills: skills,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4"
    >
      <Textarea
        ref={textareaRef}
        value={content}
        maxLength={MAX_CONTENT}
        placeholder="What did you ship today?"
        rows={3}
        onChange={(e) => setContent(e.target.value)}
        onInput={(e) => resizeTextarea(e.currentTarget)}
        className="min-h-[88px] resize-none border-zinc-800 bg-zinc-900/50 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-zinc-700 focus-visible:ring-zinc-700/40"
      />

      <div className="mt-1 flex justify-end">
        <span
          className={cn(
            "text-xs tabular-nums",
            isNearLimit ? "text-red-400" : "text-zinc-500",
          )}
        >
          {charCount}/{MAX_CONTENT}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200"
              >
                {skill}
                <button
                  type="button"
                  onClick={() =>
                    setSkills((prev) => prev.filter((s) => s !== skill))
                  }
                  className="text-zinc-400 hover:text-zinc-200"
                  aria-label={`Remove ${skill}`}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <Input
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleSkillKeyDown}
          placeholder={
            skills.length >= MAX_SKILLS
              ? "Max 10 skills"
              : "Tag skills (Enter to add)"
          }
          disabled={skills.length >= MAX_SKILLS}
          className="h-8 border-zinc-800 bg-zinc-900/40 text-sm text-zinc-200 placeholder:text-zinc-600"
        />
      </div>

      <div className="relative mt-3">
        {linkedProject ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200">
            {linkedProject.title}
            <button
              type="button"
              onClick={() => {
                setLinkedProject(null);
                setProjectQuery("");
              }}
              className="text-zinc-500 hover:text-zinc-200"
              aria-label="Remove linked project"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ) : (
          <>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-500" />
              <Input
                value={projectQuery}
                onChange={(e) => {
                  setProjectQuery(e.target.value);
                  setProjectDropdownOpen(true);
                }}
                onFocus={() => setProjectDropdownOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setProjectDropdownOpen(false), 150);
                }}
                placeholder="Link a project (optional)"
                className="h-8 border-zinc-800 bg-zinc-900/40 pl-8 text-sm text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
            {projectDropdownOpen && debouncedQuery.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg">
                {isSearchingProjects ? (
                  <p className="px-3 py-2 text-xs text-zinc-500">Searching…</p>
                ) : projectResults && projectResults.length > 0 ? (
                  <ul>
                    {projectResults.map((project) => (
                      <li key={project.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-900"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setLinkedProject(project);
                            setProjectQuery("");
                            setProjectDropdownOpen(false);
                          }}
                        >
                          <span className="text-sm text-zinc-200">
                            {project.title}
                          </span>
                          {project.oneLiner ? (
                            <span className="line-clamp-1 text-xs text-zinc-500">
                              {project.oneLiner}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-xs text-zinc-500">
                    No projects found
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="bg-zinc-100 text-zinc-950 hover:bg-white"
        >
          {createPost.isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : null}
          Ship it →
        </Button>
      </div>
    </form>
  );
}
