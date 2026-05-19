"use client";

import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { getCareerosPublicHost } from "@/lib/projectsUrls";
import { cn } from "@/lib/utils";
import {
  buildUsernameSuggestions,
  isReservedUsername,
  normalizeUsername,
  USERNAME_REGEX,
  type UsernameUnavailableReason,
} from "@/lib/username";

export type UsernameAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

type CheckResponse = {
  available: boolean;
  reason?: string;
};

const INVALID_REASON_LABELS: Record<string, string> = {
  invalid_length: "Use 3–24 characters",
  invalid_format:
    "Lowercase letters, numbers, and hyphens only — cannot start or end with a hyphen",
  reserved: "This username is reserved",
  rate_limited: "Too many checks — wait a moment",
  unavailable: "Could not check availability",
};

function reasonLabel(reason: string | undefined): string {
  if (!reason) return "Invalid username";
  return INVALID_REASON_LABELS[reason] ?? "Invalid username";
}

function clientFormatIssue(value: string): UsernameUnavailableReason | null {
  if (!value) return null;
  if (value.length < 3 || value.length > 24) return "invalid_length";
  if (!USERNAME_REGEX.test(value)) return "invalid_format";
  return null;
}

export function UsernameInput({
  value,
  onChange,
  onStatusChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onStatusChange?: (status: UsernameAvailabilityStatus) => void;
  className?: string;
}) {
  const [status, setStatus] = useState<UsernameAvailabilityStatus>("idle");
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<[string, string] | null>(null);
  const requestId = useRef(0);

  const debounced = useDebounce(value, 300);

  const updateStatus = useCallback(
    (next: UsernameAvailabilityStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange]
  );

  useEffect(() => {
    const normalized = normalizeUsername(debounced);

    if (!normalized) {
      setInvalidReason(null);
      setSuggestions(null);
      updateStatus("idle");
      return;
    }

    const localIssue = clientFormatIssue(normalized);
    if (localIssue) {
      setInvalidReason(reasonLabel(localIssue));
      setSuggestions(null);
      updateStatus("invalid");
      return;
    }

    if (isReservedUsername(normalized)) {
      setInvalidReason(reasonLabel("reserved"));
      setSuggestions(null);
      updateStatus("invalid");
      return;
    }

    const id = ++requestId.current;
    updateStatus("checking");
    setInvalidReason(null);
    setSuggestions(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/username/check?username=${encodeURIComponent(normalized)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as CheckResponse;
        if (requestId.current !== id) return;

        if (json.available) {
          setSuggestions(null);
          updateStatus("available");
          return;
        }

        const reason = json.reason ?? "taken";
        if (reason === "taken") {
          setSuggestions(buildUsernameSuggestions(normalized));
          updateStatus("taken");
          return;
        }

        setSuggestions(null);
        setInvalidReason(reasonLabel(reason));
        updateStatus("invalid");
      } catch {
        if (requestId.current !== id) return;
        setInvalidReason(reasonLabel("unavailable"));
        setSuggestions(null);
        updateStatus("invalid");
      }
    })();
  }, [debounced, updateStatus]);

  const statusIcon = useMemo(() => {
    switch (status) {
      case "checking":
        return (
          <Loader2
            className="size-4 shrink-0 animate-spin text-zinc-400"
            aria-hidden
          />
        );
      case "available":
        return (
          <Check className="size-4 shrink-0 text-emerald-400" aria-hidden />
        );
      case "taken":
        return <X className="size-4 shrink-0 text-red-400" aria-hidden />;
      case "invalid":
        return (
          <AlertTriangle
            className="size-4 shrink-0 text-amber-400"
            aria-hidden
          />
        );
      default:
        return null;
    }
  }, [status]);

  const statusMessage = useMemo(() => {
    switch (status) {
      case "available":
        return (
          <span className="text-emerald-400/90">@{value} is available</span>
        );
      case "taken":
        return <span className="text-red-400/90">@{value} is taken</span>;
      case "invalid":
        return (
          <span className="text-amber-400/90">
            {invalidReason ?? "Invalid username"}
          </span>
        );
      case "checking":
        return <span className="text-zinc-500">Checking availability…</span>;
      default:
        return (
          <span className="text-zinc-500">
            Letters, numbers, hyphens — 3–24 characters
          </span>
        );
    }
  }, [status, value, invalidReason]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-500">
          {`${getCareerosPublicHost()}/u/`}
        </span>
        <Input
          value={value}
          onChange={(e) => onChange(normalizeUsername(e.target.value))}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          placeholder="your-name"
          aria-invalid={status === "invalid" || status === "taken"}
          className={cn(
            "border-zinc-700 bg-zinc-900/80 pl-[8.75rem] pr-10 text-zinc-100 placeholder:text-zinc-600",
            status === "available" && "border-emerald-500/50",
            status === "taken" && "border-red-500/50",
            status === "invalid" && "border-amber-500/50"
          )}
        />
        {statusIcon ? (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
            {statusIcon}
          </span>
        ) : null}
      </div>

      <p className="min-h-[1.25rem] text-sm" aria-live="polite">
        {statusMessage}
      </p>

      {status === "taken" && suggestions ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500">Try one of these:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onChange(suggestion)}
                className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:border-[#E5FF47]/60 hover:text-[#E5FF47]"
              >
                @{suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}