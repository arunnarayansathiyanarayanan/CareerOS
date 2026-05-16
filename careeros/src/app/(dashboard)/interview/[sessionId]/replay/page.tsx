import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ReplayPlayer } from "@/components/interview/ReplayPlayer";
import { getInterviewFeedbackForClerk } from "@/lib/getInterviewFeedbackForClerk";
import { getInterviewSessionForClerk } from "@/lib/getInterviewSessionForClerk";
import { transcriptToLiveEntries } from "@/lib/interviews/replay";
import { normalizeTranscript } from "@/lib/interviews/transcript";
import { buildSessionAudioUrls } from "@/lib/storage/interview-audio";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function InterviewReplayPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { sessionId } = await params;
  const session = await getInterviewSessionForClerk(userId, sessionId);

  if (!session) {
    redirect("/interview");
  }

  if (session.status !== "completed") {
    redirect(`/interview/${sessionId}/feedback`);
  }

  const bundle = await getInterviewFeedbackForClerk(userId, sessionId);
  const feedback = bundle?.feedback ?? null;

  if (!feedback) {
    redirect(`/interview/${sessionId}/feedback`);
  }

  const transcript = normalizeTranscript(session.transcript);
  const sessionAudioUrls = buildSessionAudioUrls(sessionId, transcript);
  const liveTranscript = transcriptToLiveEntries(transcript, sessionAudioUrls);

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <ReplayPlayer
        transcript={liveTranscript}
        sessionAudioUrls={sessionAudioUrls}
        feedback={feedback}
        sessionId={sessionId}
      />
    </main>
  );
}
