"use client";

import { useEffect, useRef } from "react";

import {
  captureAttributionFromWindow,
  mergeSnapshotIntoSession,
} from "@/lib/careerosAttribution";

export function useUTMCapture() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    mergeSnapshotIntoSession(captureAttributionFromWindow());
  }, []);
}
