import type { ResumeVariant } from "@/db/schema/resume";

/** Client-side variant row from resume API JSON responses. */
export type ResumeVariantClient = Omit<ResumeVariant, "createdAt"> & {
  createdAt: string;
};
