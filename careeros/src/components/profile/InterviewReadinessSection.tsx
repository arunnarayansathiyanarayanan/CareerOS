import { Progress } from "@/components/ui/progress";
import type { Track } from "@/lib/ai/question-bank";
import { getTrackLabel } from "@/lib/interviews/labels";
import type { ProfileInterviewReadinessDTO } from "@/server/routers/profile";

const TRACKS: Track[] = ["ai_pm", "ai_generalist"];

export function InterviewReadinessSection({
  scores,
}: {
  scores: ProfileInterviewReadinessDTO["scores"];
}) {
  return (
    <section className="min-h-[120px] space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Interview readiness
        </h2>
        <p className="text-sm text-zinc-400">
          Mock interview scores from completed sessions on CareerOS.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TRACKS.map((track) => {
          const row = scores.find((item) => item.track === track);
          const hasSessions = row != null && row.session_count > 0;

          return (
            <div
              key={track}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {getTrackLabel(track)}
              </p>
              {hasSessions && row ? (
                <>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-50">
                    {Math.round(row.score)}
                    <span className="text-base font-normal text-zinc-500">
                      {" "}
                      / 100
                    </span>
                  </p>
                  <Progress
                    value={Math.min(100, Math.max(0, row.score))}
                    className="mt-3 h-1.5 bg-zinc-800 [&_[data-slot=progress-indicator]]:bg-indigo-500"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Avg interview score {row.avg_overall_score.toFixed(1)}/10 ·{" "}
                    {row.session_count}{" "}
                    {row.session_count === 1 ? "session" : "sessions"}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">
                  No scored sessions for this track yet.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
