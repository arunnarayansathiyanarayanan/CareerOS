"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export function LeaveCohortButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const leave = api.community.cohort.leave.useMutation({
    onSuccess: () => {
      setOpen(false);
      router.push("/onboarding");
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Leave cohort
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave your cohort?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll be reassigned to a new cohort on your next active day.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={leave.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={leave.isPending}
            onClick={(e) => {
              e.preventDefault();
              leave.mutate();
            }}
          >
            {leave.isPending ? "Leaving…" : "Leave cohort"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
