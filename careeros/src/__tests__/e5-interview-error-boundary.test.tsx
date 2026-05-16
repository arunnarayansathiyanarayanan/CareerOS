import { render, screen } from "@testing-library/react";

import { InterviewErrorBoundary } from "@/components/interview/InterviewErrorBoundary";

function ThrowingChild() {
  throw new Error("studio render failed");
}

describe("InterviewErrorBoundary", () => {
  it("shows recovery UI when a child throws", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    render(
      <InterviewErrorBoundary>
        <ThrowingChild />
      </InterviewErrorBoundary>
    );

    expect(
      screen.getByText("Something went wrong with your interview session.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to Interview Home" })
    ).toHaveAttribute("href", "/interview");

    consoleSpy.mockRestore();
  });
});
