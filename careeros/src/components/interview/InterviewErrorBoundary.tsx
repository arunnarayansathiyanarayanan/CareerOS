"use client";

import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class InterviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (process.env.NODE_ENV === "development") {
      console.error("[InterviewErrorBoundary]", error, errorInfo);
      return;
    }
    console.error("[InterviewErrorBoundary] Sentry MVP:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="max-w-md text-lg font-medium text-[#F8F8FF]">
            Something went wrong with your interview session.
          </p>
          <Button asChild variant="outline">
            <Link href="/interview">Return to Interview Home</Link>
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
