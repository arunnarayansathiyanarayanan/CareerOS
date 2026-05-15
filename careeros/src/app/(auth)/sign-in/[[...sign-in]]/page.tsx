import { SignIn } from "@clerk/nextjs";

import { careerosClerkAppearance } from "@/lib/clerkCareerosAppearance";

function safeInternalPath(raw: string | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const afterSignIn = safeInternalPath(redirect_url, "/onboarding");

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12">
      <SignIn
        path="/sign-in"
        routing="path"
        appearance={careerosClerkAppearance}
        fallbackRedirectUrl={afterSignIn}
      />
    </div>
  );
}
