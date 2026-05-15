import { ClerkProvider } from "@clerk/nextjs";

export default function AuthGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
