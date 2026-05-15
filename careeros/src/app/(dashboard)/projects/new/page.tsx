import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ProjectBuilder } from "@/components/projects/ProjectBuilder";

export default async function NewProjectPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="px-4 pb-32 pt-6 sm:px-6 md:pt-8">
      <ProjectBuilder />
    </main>
  );
}
