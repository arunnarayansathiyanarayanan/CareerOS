"use client";

import { useUTMCapture } from "@/hooks/useUTMCapture";

export function UtmCaptureRoot() {
  useUTMCapture();
  return null;
}
