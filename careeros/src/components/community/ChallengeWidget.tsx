"use client";

import { Loader2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChallengeStatus } from "@/server/db/schema/community.schema";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const STATUS_STYLES: Record<ChallengeStatus, string> = {
  UPCOMING: "bg-zinc-700 text-zinc-400",
  ACTIVE: "bg-green-500/20 text-green-400",
  VOTING: "bg-amber-500/20 text-amber-400",
  CLOSED: "bg-zinc-700 text-zinc-400",
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0d 0h 0m 0s";
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

export function ChallengeWidget() {
  const utils = api.useUtils();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");
  const [now, setNow] = React.useState(() => Date.now());

  const { data, isLoading } = api.community.challenge.getCurrent.useQuery(
    undefined,
    { refetchInterval: 60_000 },
  );

  const { data: myProjects, isLoading: projectsLoading } =
    api.project.listMine.useQuery(undefined, {
      enabled: dialogOpen,
    });

  const submitMutation = api.community.challenge.submit.useMutation({
    onSuccess: async () => {
      toast.success("Challenge entry submitted");
      setDialogOpen(false);
      setSelectedProjectId("");
      await utils.community.challenge.getCurrent.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const challenge = data?.challenge;
  const userHasSubmitted = data?.userHasSubmitted ?? false;

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (isLoading) {
    return (
      <div className="h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-800/30" />
    );
  }

  if (!challenge) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <p className="text-sm text-zinc-500">No active challenge right now.</p>
      </div>
    );
  }

  const deadline =
    challenge.status === "VOTING"
      ? new Date(challenge.votingDeadline)
      : challenge.status === "ACTIVE"
        ? new Date(challenge.submissionDeadline)
        : null;

  const countdown =
    deadline != null ? formatCountdown(deadline.getTime() - now) : null;

  return (
    <>
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">
                {challenge.title}
              </h3>
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
                  STATUS_STYLES[challenge.status],
                )}
              >
                {challenge.status}
              </span>
            </div>
            <p className="line-clamp-2 text-xs text-zinc-500">
              {challenge.description}
            </p>
          </div>

          {userHasSubmitted ? (
            <span className="shrink-0 rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-400">
              ✓ Submitted
            </span>
          ) : challenge.status === "ACTIVE" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="shrink-0 bg-zinc-100 text-zinc-950 hover:bg-white"
            >
              Submit entry
            </Button>
          ) : null}
        </div>

        {countdown != null ? (
          <p className="mt-3 font-mono text-xs tabular-nums text-zinc-400">
            {countdown}
          </p>
        ) : null}

        <p className="mt-2 text-xs text-zinc-600">
          {data?.submissionCount ?? 0} submissions
        </p>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Submit to challenge
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Pick a published project with an AI reviewer score of at least 5.
            </DialogDescription>
          </DialogHeader>

          {projectsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2Icon className="size-5 animate-spin text-zinc-500" />
            </div>
          ) : myProjects && myProjects.length > 0 ? (
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger className="border-zinc-800 bg-zinc-900 text-zinc-200">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {myProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-zinc-500">
              Publish a project first to enter the challenge.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedProjectId || submitMutation.isPending}
              onClick={() =>
                submitMutation.mutate({
                  challengeId: challenge.id,
                  projectId: selectedProjectId,
                })
              }
              className="bg-zinc-100 text-zinc-950 hover:bg-white"
            >
              {submitMutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
