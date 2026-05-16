import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { InterviewErrorBoundary } from "@/components/interview/InterviewErrorBoundary";
import { InterviewStudio } from "@/components/interview/InterviewStudio";
import { getInterviewSessionForClerk } from "@/lib/getInterviewSessionForClerk";
import { buildInterviewStudioProps } from "@/lib/interviews/session-studio";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function InterviewSessionPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { sessionId } = await params;
  const session = await getInterviewSessionForClerk(userId, sessionId);

  if (!session) {
    redirect("/interview");
  }

  if (session.status === "completed") {
    redirect(`/interview/${sessionId}/feedback`);
  }

  if (session.status !== "in_progress") {
    redirect("/interview");
  }

  const studioProps = buildInterviewStudioProps(session);

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <InterviewErrorBoundary>
        <InterviewStudio {...studioProps} />
      </InterviewErrorBoundary>
    </main>
  );
}
