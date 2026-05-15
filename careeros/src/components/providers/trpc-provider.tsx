"use client";

import { TRPCReactProvider } from "@/trpc/react";

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  return <TRPCReactProvider>{children}</TRPCReactProvider>;
}
