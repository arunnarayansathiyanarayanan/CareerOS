import { SignUp } from "@clerk/nextjs";

import { careerosClerkAppearance } from "@/lib/clerkCareerosAppearance";

function safeInternalPath(raw: string | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const afterSignUp = safeInternalPath(redirect_url, "/onboarding");

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12">
      <SignUp
        path="/sign-up"
        routing="path"
        appearance={careerosClerkAppearance}
        fallbackRedirectUrl={afterSignUp}
      />
    </div>
  );
}
