"use client";

import { useEffect, useRef } from "react";

export function ProfileViewTracker({ username }: { username: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const referrer =
      typeof document !== "undefined" && document.referrer.startsWith("http")
        ? document.referrer
        : undefined;

    void fetch("/api/profile/record-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username,
        source: "DIRECT",
        ...(referrer ? { referrerUrl: referrer } : {}),
      }),
      keepalive: true,
    });
  }, [username]);

  return null;
}
