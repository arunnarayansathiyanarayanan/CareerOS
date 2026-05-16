import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InterviewHistoryClient } from "@/components/interview/InterviewHistoryClient";
import {
  getChartSessionsForClerk,
  getInterviewHistoryForClerk,
} from "@/lib/interviews/history";
import { getOnboardingCompleteForClerk } from "@/lib/getOnboardingCompleteForClerk";

const SERVER_PAGE_SIZE = 50;

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function InterviewHistoryPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const onboardingComplete = await getOnboardingCompleteForClerk(userId);
  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const serverPage = Math.max(1, Number(params.page) || 1);

  const [history, chartSessions] = await Promise.all([
    getInterviewHistoryForClerk(userId, {
      page: serverPage,
      limit: SERVER_PAGE_SIZE,
    }),
    getChartSessionsForClerk(userId, 10),
  ]);

  if (!history) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-zinc-400">
          Could not load interview history. Check your connection and try again.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 space-y-2">
        <Link
          href="/interview"
          className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
        >
          ← Back to interview home
        </Link>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          CareerOS
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Interview history
        </h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Review past sessions, track your scores over time, and jump back into
          practice.
        </p>
      </header>

      <InterviewHistoryClient
        sessions={history.sessions}
        chartSessions={chartSessions}
        total={history.total}
        serverPage={history.page}
        serverPageSize={SERVER_PAGE_SIZE}
      />
    </main>
  );
}
