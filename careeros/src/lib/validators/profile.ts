import { z } from "zod";

import {
  type Profile,
  profileAvailabilityStatusEnum,
  profileVisibilityEnum,
} from "@/db/schema/profile";

type ProfileAvailability = Profile["availabilityStatus"];
type ProfileVisibility = Profile["visibility"];

const PROFILE_AVAILABILITY_TUPLE =
  profileAvailabilityStatusEnum.enumValues as [
    ProfileAvailability,
    ...ProfileAvailability[],
  ];

const PROFILE_VISIBILITY_TUPLE = profileVisibilityEnum.enumValues as [
  ProfileVisibility,
  ...ProfileVisibility[],
];

export const profileAvailabilitySchema = z.enum(PROFILE_AVAILABILITY_TUPLE);
export const profileVisibilitySchema = z.enum(PROFILE_VISIBILITY_TUPLE);

/** Partial patch payload for `profile.updateProfile` (server + client mutate). */
export const updateProfileInputSchema = z.object({
  headline: z.union([z.string().max(160), z.null()]).optional(),
  availabilityStatus: profileAvailabilitySchema.optional(),
  visibility: profileVisibilitySchema.optional(),
  location: z.union([z.string().max(100), z.null()]).optional(),
  pinnedProjectIds: z.array(z.string().uuid()).max(5).optional(),
  interviewReadinessPublic: z.boolean().optional(),
});

/** Full form shape for Edit Profile modal (same field rules, all required). */
export const editProfileFormSchema = z.object({
  headline: z.string().max(160),
  availabilityStatus: profileAvailabilitySchema,
  visibility: profileVisibilitySchema,
  location: z.string().max(100),
  pinnedProjectIds: z.array(z.string().uuid()).max(5),
  interviewReadinessPublic: z.boolean(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type EditProfileFormValues = z.infer<typeof editProfileFormSchema>;

export const PROFILE_LOCATION_SUGGESTIONS = [
  "Bengaluru",
  "Mumbai",
  "Hyderabad",
  "Pune",
  "Delhi NCR",
  "Remote",
] as const;

export const PROFILE_VISIBILITY_OPTIONS = [
  { value: "PUBLIC" as const, label: "Public" },
  { value: "PRIVATE" as const, label: "Private" },
  { value: "ANONYMOUS" as const, label: "Anonymous" },
] as const;
