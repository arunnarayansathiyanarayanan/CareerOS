import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

import {
  clearAttributionSession,
  flattenAttributionSnapshot,
  readAttributionFromSession,
} from "@/lib/careerosAttribution";

const STORAGE_KEY = "careeros_onboarding";

const serverStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const STRING_FIELDS = [
  "targetRole",
  "username",
  "currentRole",
  "yearsOfExperience",
  "aiFluency",
  "referralSource",
] as const;

type StringField = (typeof STRING_FIELDS)[number];

function isStringField(field: string): field is StringField {
  return (STRING_FIELDS as readonly string[]).includes(field);
}

export interface OnboardingState {
  step: number;
  targetRole: string | null;
  username: string | null;
  currentRole: string | null;
  yearsOfExperience: string | null;
  aiFluency: string | null;
  resumeFile: File | null;
  resumeUploaded: boolean;
  referralSource: string | null;
  utmParams: Record<string, string>;
  startedAt: number | null;

  setStep: (step: number) => void;
  setField: (field: string, value: string) => void;
  setResumeFile: (file: File | null) => void;
  setResumeUploaded: (v: boolean) => void;
  /** Merge `careeros_utm` session snapshot into `utmParams` (call before completing onboarding). */
  mergeSessionAttributionIntoUtmParams: () => void;
  /** Remove `careeros_utm` from sessionStorage (call after successful onboarding submit). */
  clearSessionAttribution: () => void;
  /** Apply server GET /progress profile without touching `startedAt` (resume). */
  applyServerProgress: (profile: {
    step: number;
    targetRole: string | null;
    username: string | null;
    currentRole: string | null;
    yearsOfExperience: string | null;
    aiFluency: string | null;
    referralSource: string | null;
    utmParams: Record<string, string>;
    resumeUrl: string | null;
  }) => void;
  /** Call when the user is on step 1 so `startedAt` reflects first entry on that step. */
  ensureStepOneStarted: () => void;
  reset: () => void;
}

const initialData = {
  step: 1,
  targetRole: null,
  username: null,
  currentRole: null,
  yearsOfExperience: null,
  aiFluency: null,
  resumeFile: null as File | null,
  resumeUploaded: false,
  referralSource: null,
  utmParams: {} as Record<string, string>,
  startedAt: null as number | null,
};

function markStartedIfNeeded(draft: { startedAt: number | null }) {
  if (draft.startedAt === null) {
    draft.startedAt = Date.now();
  }
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    immer((set) => ({
      ...initialData,

      setStep: (step) =>
        set((draft) => {
          draft.step = step;
          if (step === 1) {
            markStartedIfNeeded(draft);
          }
        }),

      setField: (field, value) =>
        set((draft) => {
          if (!isStringField(field)) return;
          draft[field] = value.length === 0 ? null : value;
        }),

      setResumeFile: (file) =>
        set((draft) => {
          draft.resumeFile = file;
        }),

      setResumeUploaded: (v) =>
        set((draft) => {
          draft.resumeUploaded = v;
        }),

      mergeSessionAttributionIntoUtmParams: () =>
        set((draft) => {
          const snap = readAttributionFromSession();
          if (!snap) return;
          const flat = flattenAttributionSnapshot(snap);
          if (Object.keys(flat).length === 0) return;
          draft.utmParams = { ...draft.utmParams, ...flat };
        }),

      clearSessionAttribution: () => {
        clearAttributionSession();
      },

      applyServerProgress: (profile) =>
        set((draft) => {
          draft.step = Math.max(1, Math.min(7, profile.step));
          if (profile.targetRole !== null) draft.targetRole = profile.targetRole;
          if (profile.username !== null) draft.username = profile.username;
          if (profile.currentRole !== null) draft.currentRole = profile.currentRole;
          if (profile.yearsOfExperience !== null) {
            draft.yearsOfExperience = profile.yearsOfExperience;
          }
          if (profile.aiFluency !== null) draft.aiFluency = profile.aiFluency;
          if (profile.referralSource !== null) {
            draft.referralSource = profile.referralSource;
          }
          if (Object.keys(profile.utmParams).length > 0) {
            draft.utmParams = { ...draft.utmParams, ...profile.utmParams };
          }
          if (profile.resumeUrl) {
            draft.resumeUploaded = true;
          }
        }),

      ensureStepOneStarted: () =>
        set((draft) => {
          if (draft.step === 1) {
            markStartedIfNeeded(draft);
          }
        }),

      reset: () =>
        set((draft) => {
          draft.step = initialData.step;
          draft.targetRole = initialData.targetRole;
          draft.username = initialData.username;
          draft.currentRole = initialData.currentRole;
          draft.yearsOfExperience = initialData.yearsOfExperience;
          draft.aiFluency = initialData.aiFluency;
          draft.resumeFile = initialData.resumeFile;
          draft.resumeUploaded = initialData.resumeUploaded;
          draft.referralSource = initialData.referralSource;
          draft.utmParams = { ...initialData.utmParams };
          draft.startedAt = initialData.startedAt;
        }),
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? serverStorage : window.localStorage
      ),
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- File cannot be serialized to JSON
        const { resumeFile, ...persisted } = state;
        return persisted;
      },
    }
  )
);
