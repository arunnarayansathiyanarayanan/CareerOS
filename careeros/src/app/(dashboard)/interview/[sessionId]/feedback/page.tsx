import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { FeedbackPendingPoller } from "@/components/interview/FeedbackPendingPoller";
import { FeedbackReport } from "@/components/interview/FeedbackReport";
import { getInterviewFeedbackForClerk } from "@/lib/getInterviewFeedbackForClerk";
import { getInterviewSessionForClerk } from "@/lib/getInterviewSessionForClerk";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function InterviewFeedbackPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { sessionId } = await params;
  const session = await getInterviewSessionForClerk(userId, sessionId);

  if (!session) {
    redirect("/interview");
  }

  const bundle = await getInterviewFeedbackForClerk(userId, sessionId);
  const feedback = bundle?.feedback ?? null;

  if (!feedback || session.status !== "completed") {
    return <FeedbackPendingPoller sessionId={sessionId} />;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0A0A0F] font-sans text-[#F8F8FF]">
      <FeedbackReport
        feedback={feedback}
        session={session}
        sessionId={sessionId}
        helpfulnessRating={bundle?.helpfulnessRating ?? null}
        onRate={() => {}}
      />
    </main>
  );
}
