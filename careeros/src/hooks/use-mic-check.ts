"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicCheckStatus = "idle" | "checking" | "ok" | "denied" | "error";

export function useMicCheck(): {
  status: MicCheckStatus;
  volumeLevel: number;
  startCheck: () => void;
  stopCheck: () => void;
} {
  const [status, setStatus] = useState<MicCheckStatus>("idle");
  const [volumeLevel, setVolumeLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const okTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peakVolumeRef = useRef(0);

  const stopCheck = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (okTimerRef.current !== null) {
      clearTimeout(okTimerRef.current);
      okTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVolumeLevel(0);
    peakVolumeRef.current = 0;
  }, []);

  const startCheck = useCallback(() => {
    stopCheck();
    setStatus("checking");
    setVolumeLevel(0);
    peakVolumeRef.current = 0;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            sum += data[i]!;
          }
          const avg = sum / data.length;
          const level = Math.min(100, Math.round((avg / 255) * 100 * 1.4));
          peakVolumeRef.current = Math.max(peakVolumeRef.current, level);
          setVolumeLevel(level);

          if (peakVolumeRef.current >= 8) {
            setStatus("ok");
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);

        okTimerRef.current = setTimeout(() => {
          if (peakVolumeRef.current >= 8) {
            setStatus("ok");
          }
        }, 1500);
      } catch (err) {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setStatus("denied");
        } else {
          setStatus("error");
        }
        stopCheck();
      }
    })();
  }, [stopCheck]);

  useEffect(() => {
    return () => {
      stopCheck();
    };
  }, [stopCheck]);

  return { status, volumeLevel, startCheck, stopCheck };
}
