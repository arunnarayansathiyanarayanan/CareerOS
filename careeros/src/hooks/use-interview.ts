"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  FeedbackResponse,
  StartInterviewResponse,
  TurnInterviewResponse,
} from "@/lib/interviews/types";

export type InterviewState =
  | "idle"
  | "starting"
  | "mic_check"
  | "listening"
  | "processing"
  | "speaking"
  | "completed"
  | "error";

export type InterviewMode = "voice" | "text";

export type LiveTranscriptEntry = {
  role: "interviewer" | "candidate";
  content: string;
  timestamp_ms: number;
  audioUrl?: string;
};

export type StartParams = {
  track: "ai_pm" | "ai_generalist";
  subMode: string;
  projectContextIds?: string[];
};

export type ResumeSessionParams = {
  sessionId: string;
  mode: InterviewMode;
  transcript: LiveTranscriptEntry[];
  currentQuestion: string;
  currentAudioUrl: string | null;
  turnNumber: number;
  totalTurns: number;
  initialState?: "mic_check" | "listening";
  openingAlreadyPlayed?: boolean;
};

export type UseInterviewReturn = {
  interviewState: InterviewState;
  mode: InterviewMode;
  sessionId: string | null;
  currentQuestion: string | null;
  currentAudioUrl: string | null;
  turnNumber: number;
  totalTurns: number;
  liveTranscript: LiveTranscriptEntry[];
  isRecording: boolean;
  recordingDuration: number;
  textInput: string;
  errorMessage: string | null;
  isComplete: boolean;
  isPaused: boolean;
  startInterview: (params: StartParams) => Promise<void>;
  resumeSession: (params: ResumeSessionParams) => void;
  startRecording: () => void;
  stopRecordingAndSubmit: () => Promise<void>;
  submitTextTurn: () => Promise<void>;
  switchToTextMode: () => void;
  setTextInput: (v: string) => void;
  togglePause: () => void;
  reset: () => void;
};

const MAX_RECORDING_SECONDS = 300;
const FEEDBACK_POLL_MS = 3000;
const FEEDBACK_MAX_ATTEMPTS = 10;
const NETWORK_RETRY_MS = 2000;

const PREFERRED_MIME = "audio/webm;codecs=opus";
const FALLBACK_MIME = "audio/webm";

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(PREFERRED_MIME)) {
    return PREFERRED_MIME;
  }
  return FALLBACK_MIME;
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_MS));
    return fetch(input, init);
  }
}

export function useInterview(): UseInterviewReturn {
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [mode, setMode] = useState<InterviewMode>("voice");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [turnNumber, setTurnNumber] = useState(1);
  const [totalTurns, setTotalTurns] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<LiveTranscriptEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [textInput, setTextInputState] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const modeRef = useRef<InterviewMode>("voice");
  const isPausedRef = useRef(false);
  const pendingAutoStartRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const turnNumberRef = useRef(1);
  const interviewStateRef = useRef<InterviewState>("idle");
  const currentAudioUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const openingPlayedRef = useRef(false);
  const submitInFlightRef = useRef(false);

  const clearRecordingTimers = useCallback(() => {
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (maxDurationTimeoutRef.current !== null) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    const audio = playbackAudioRef.current;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = "";
    playbackAudioRef.current = null;
  }, []);

  const stopMediaRecorder = useCallback(() => {
    clearRecordingTimers();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // already stopped
      }
    }
    mediaRecorderRef.current = null;
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  }, [clearRecordingTimers]);

  const cleanupAll = useCallback(() => {
    stopMediaRecorder();
    stopPlayback();
    submitInFlightRef.current = false;
    openingPlayedRef.current = false;
  }, [stopMediaRecorder, stopPlayback]);

  const pollFeedback = useCallback(async (sid: string) => {
    for (let attempt = 0; attempt < FEEDBACK_MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, FEEDBACK_POLL_MS));
      }

      try {
        const res = await fetchWithRetry(`/api/interviews/${sid}/feedback`);
        if (!res.ok) continue;

        const data = (await res.json()) as FeedbackResponse | { error: string };
        if ("feedback" in data && data.feedback) {
          setInterviewState("completed");
          return;
        }
        if ("status" in data && data.status === "pending") {
          continue;
        }
      } catch {
        // try next poll
      }
    }

    setInterviewState("completed");
  }, []);

  const playInterviewerAudioRef = useRef<(audioUrl: string | null, onDone: () => void) => void>(
    () => undefined
  );

  const beginListeningRef = useRef<(autoRecord: boolean) => void>(() => undefined);
  const stopRecordingAndSubmitRef = useRef<() => Promise<void>>(async () => undefined);

  playInterviewerAudioRef.current = (audioUrl, onDone) => {
    if (modeRef.current === "text" || !audioUrl) {
      onDone();
      return;
    }

    stopPlayback();
    setInterviewState("speaking");

    const audio = new Audio(audioUrl);
    playbackAudioRef.current = audio;

    const finish = () => {
      playbackAudioRef.current = null;
      onDone();
    };

    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().catch(finish);
  };

  beginListeningRef.current = (autoRecord) => {
    setInterviewState("listening");
    if (autoRecord && modeRef.current === "voice" && !isPausedRef.current) {
      queueMicrotask(() => {
        void startMicCaptureRef.current();
      });
    } else if (autoRecord && isPausedRef.current) {
      pendingAutoStartRef.current = true;
    }
  };

  const handleTurnResponse = useCallback(
    async (response: TurnInterviewResponse, candidateText: string) => {
      const now = Date.now();
      const nextCandidateTurn = response.turnNumber;

      setLiveTranscript((prev) => [
        ...prev,
        { role: "candidate", content: candidateText, timestamp_ms: now },
        {
          role: "interviewer",
          content: response.question,
          timestamp_ms: now + 1,
          audioUrl: response.audioUrl ?? undefined,
        },
      ]);

      setCurrentQuestion(response.question);
      setCurrentAudioUrl(response.audioUrl);
      currentAudioUrlRef.current = response.audioUrl;
      setTurnNumber(nextCandidateTurn);
      turnNumberRef.current = nextCandidateTurn;

      if (response.isComplete) {
        setIsComplete(true);
        const sid = sessionIdRef.current;
        if (sid) {
          await pollFeedback(sid);
        } else {
          setInterviewState("completed");
        }
        return;
      }

      playInterviewerAudioRef.current(response.audioUrl, () => {
        if (isPausedRef.current) {
          pendingAutoStartRef.current = true;
        } else {
          beginListeningRef.current(true);
        }
      });
    },
    [pollFeedback, stopPlayback]
  );

  const submitTurn = useCallback(
    async (formData: FormData, candidateTextForTranscript: string) => {
      const sid = sessionIdRef.current;
      if (!sid || submitInFlightRef.current) return;

      submitInFlightRef.current = true;
      setInterviewState("processing");
      setErrorMessage(null);

      try {
        const res = await fetchWithRetry(`/api/interviews/${sid}/turn`, {
          method: "POST",
          body: formData,
        });

        const body = (await res.json()) as TurnInterviewResponse & {
          error?: string;
          fallback?: string;
          resetAt?: string;
        };

        if (!res.ok) {
          if (body.error === "stt_failed" && body.fallback === "text") {
            setMode("text");
            modeRef.current = "text";
            toast.message("Switching to text mode for this turn.");
            setInterviewState("listening");
            return;
          }

          if (body.error === "weekly_limit_reached" && body.resetAt) {
            const resetDate = new Date(body.resetAt).toLocaleString();
            setErrorMessage(
              `Weekly interview limit reached. You can start a new session after ${resetDate}.`
            );
            setInterviewState("error");
            return;
          }

          setErrorMessage(
            typeof body.error === "string" ? body.error : "Failed to submit turn"
          );
          setInterviewState("error");
          return;
        }

        const transcriptText = body.transcribedText ?? candidateTextForTranscript;
        await handleTurnResponse(body, transcriptText);
      } catch {
        setErrorMessage("Network error. Please try again.");
        setInterviewState("error");
      } finally {
        submitInFlightRef.current = false;
      }
    },
    [handleTurnResponse]
  );

  const startMicCaptureRef = useRef<() => Promise<void>>(async () => undefined);

  startMicCaptureRef.current = async () => {
    if (submitInFlightRef.current || mediaRecorderRef.current) return;
    if (interviewStateRef.current !== "listening") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      clearRecordingTimers();
      if (!isPausedRef.current) {
        durationIntervalRef.current = setInterval(() => {
          if (isPausedRef.current) return;
          setRecordingDuration((seconds) => {
            const next = seconds + 1;
            if (next >= MAX_RECORDING_SECONDS) {
              void stopRecordingAndSubmitRef.current();
            }
            return next;
          });
        }, 1000);
      }

      maxDurationTimeoutRef.current = setTimeout(() => {
        void stopRecordingAndSubmitRef.current();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch {
      setErrorMessage("Microphone access is required for voice mode.");
      setInterviewState("error");
    }
  };

  stopRecordingAndSubmitRef.current = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || submitInFlightRef.current) return;

    clearRecordingTimers();

    const mimeType = recorder.mimeType || pickRecorderMimeType();

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        resolve();
      }
    });

    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);

    const blob = new Blob(audioChunksRef.current, { type: mimeType });
    audioChunksRef.current = [];

    const sid = sessionIdRef.current;
    if (!sid) return;

    const formData = new FormData();
    formData.append("audioBlob", blob, `turn-${turnNumberRef.current}.webm`);
    formData.append("turnNumber", String(turnNumberRef.current));
    formData.append("mode", "voice");

    await submitTurn(formData, "");
  };

  const resumeSession = useCallback(
    (params: ResumeSessionParams) => {
      cleanupAll();
      setErrorMessage(null);
      setIsComplete(false);
      setIsPaused(false);
      isPausedRef.current = false;
      pendingAutoStartRef.current = false;
      setTextInputState("");

      setSessionId(params.sessionId);
      sessionIdRef.current = params.sessionId;
      setMode(params.mode);
      modeRef.current = params.mode;
      setLiveTranscript(params.transcript);
      setCurrentQuestion(params.currentQuestion);
      setCurrentAudioUrl(params.currentAudioUrl);
      currentAudioUrlRef.current = params.currentAudioUrl;
      setTurnNumber(params.turnNumber);
      turnNumberRef.current = params.turnNumber;
      setTotalTurns(params.totalTurns);
      openingPlayedRef.current = params.openingAlreadyPlayed ?? false;
      setInterviewState(params.initialState ?? "mic_check");
    },
    [cleanupAll]
  );

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      isPausedRef.current = next;

      if (next) {
        clearRecordingTimers();
      } else if (
        mediaRecorderRef.current &&
        interviewStateRef.current === "listening"
      ) {
        durationIntervalRef.current = setInterval(() => {
          if (isPausedRef.current) return;
          setRecordingDuration((seconds) => {
            const nextSec = seconds + 1;
            if (nextSec >= MAX_RECORDING_SECONDS) {
              void stopRecordingAndSubmitRef.current();
            }
            return nextSec;
          });
        }, 1000);

        if (pendingAutoStartRef.current && modeRef.current === "voice") {
          pendingAutoStartRef.current = false;
          queueMicrotask(() => {
            void startMicCaptureRef.current();
          });
        }
      } else if (pendingAutoStartRef.current) {
        pendingAutoStartRef.current = false;
        beginListeningRef.current(true);
      }

      return next;
    });
  }, [clearRecordingTimers]);

  const startInterview = useCallback(
    async (params: StartParams) => {
      cleanupAll();
      setInterviewState("starting");
      setErrorMessage(null);
      setIsComplete(false);
      setMode("voice");
      modeRef.current = "voice";
      setTextInputState("");
      setTurnNumber(1);
      turnNumberRef.current = 1;
      openingPlayedRef.current = false;

      try {
        const res = await fetchWithRetry("/api/interviews/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            track: params.track,
            subMode: params.subMode,
            projectContextIds: params.projectContextIds,
          }),
        });

        const body = (await res.json()) as StartInterviewResponse & {
          error?: string;
          resetAt?: string;
        };

        if (!res.ok) {
          if (body.error === "weekly_limit_reached" && body.resetAt) {
            const resetDate = new Date(body.resetAt).toLocaleString();
            setErrorMessage(
              `Weekly interview limit reached. You can start a new session after ${resetDate}.`
            );
          } else {
            setErrorMessage(
              typeof body.error === "string" ? body.error : "Failed to start interview"
            );
          }
          setInterviewState("error");
          return;
        }

        setSessionId(body.sessionId);
        sessionIdRef.current = body.sessionId;
        setCurrentQuestion(body.openingQuestion);
        setCurrentAudioUrl(body.audioUrl);
        currentAudioUrlRef.current = body.audioUrl;
        setTotalTurns(body.totalTurns);
        setLiveTranscript([
          {
            role: "interviewer",
            content: body.openingQuestion,
            timestamp_ms: 0,
            audioUrl: body.audioUrl,
          },
        ]);
        setInterviewState("mic_check");
      } catch {
        setErrorMessage("Network error. Please try again.");
        setInterviewState("error");
      }
    },
    [cleanupAll]
  );

  const startRecording = useCallback(() => {
    if (interviewStateRef.current === "mic_check" && !openingPlayedRef.current) {
      openingPlayedRef.current = true;

      if (modeRef.current === "text") {
        setInterviewState("listening");
        return;
      }

      playInterviewerAudioRef.current(currentAudioUrlRef.current, () => {
        beginListeningRef.current(true);
      });
      return;
    }

    if (interviewStateRef.current === "listening" && modeRef.current === "voice") {
      void startMicCaptureRef.current();
    }
  }, []);

  const stopRecordingAndSubmit = useCallback(async () => {
    await stopRecordingAndSubmitRef.current();
  }, []);

  const switchToTextMode = useCallback(() => {
    stopMediaRecorder();
    setMode("text");
    modeRef.current = "text";
    setInterviewState("listening");
  }, [stopMediaRecorder]);

  const submitTextTurn = useCallback(async () => {
    const trimmed = textInput.trim();
    if (!trimmed || submitInFlightRef.current) return;

    const sid = sessionIdRef.current;
    if (!sid) return;

    const formData = new FormData();
    formData.append("textInput", trimmed);
    formData.append("turnNumber", String(turnNumberRef.current));
    formData.append("mode", "text");

    setTextInputState("");
    await submitTurn(formData, trimmed);
  }, [submitTurn, textInput]);

  const reset = useCallback(() => {
    cleanupAll();
    setIsPaused(false);
    isPausedRef.current = false;
    pendingAutoStartRef.current = false;
    setInterviewState("idle");
    setMode("voice");
    modeRef.current = "voice";
    setSessionId(null);
    sessionIdRef.current = null;
    setCurrentQuestion(null);
    setCurrentAudioUrl(null);
    currentAudioUrlRef.current = null;
    setTurnNumber(1);
    turnNumberRef.current = 1;
    setTotalTurns(0);
    setLiveTranscript([]);
    setTextInputState("");
    setErrorMessage(null);
    setIsComplete(false);
  }, [cleanupAll]);

  const setTextInput = useCallback((v: string) => {
    setTextInputState(v);
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    turnNumberRef.current = turnNumber;
  }, [turnNumber]);

  useEffect(() => {
    interviewStateRef.current = interviewState;
  }, [interviewState]);

  useEffect(() => {
    currentAudioUrlRef.current = currentAudioUrl;
  }, [currentAudioUrl]);

  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, [cleanupAll]);

  return {
    interviewState,
    mode,
    sessionId,
    currentQuestion,
    currentAudioUrl,
    turnNumber,
    totalTurns,
    liveTranscript,
    isRecording,
    recordingDuration,
    textInput,
    errorMessage,
    isComplete,
    isPaused,
    startInterview,
    resumeSession,
    startRecording,
    stopRecordingAndSubmit,
    submitTextTurn,
    switchToTextMode,
    setTextInput,
    togglePause,
    reset,
  };
}
