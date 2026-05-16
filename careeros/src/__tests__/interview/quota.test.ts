import { describe, expect, it } from "vitest";

import { isUnstartedInterviewTranscript } from "@/lib/interviews/quota";

describe("isUnstartedInterviewTranscript", () => {
  it("returns true when only interviewer lines exist", () => {
    expect(
      isUnstartedInterviewTranscript([
        { role: "interviewer", content: "Hello", turn_number: 0 },
      ])
    ).toBe(true);
  });

  it("returns false after the candidate has answered", () => {
    expect(
      isUnstartedInterviewTranscript([
        { role: "interviewer", content: "Hello", turn_number: 0 },
        { role: "candidate", content: "Hi", turn_number: 1 },
      ])
    ).toBe(false);
  });

  it("returns false for empty or invalid transcript", () => {
    expect(isUnstartedInterviewTranscript([])).toBe(false);
    expect(isUnstartedInterviewTranscript(null)).toBe(false);
  });
});
