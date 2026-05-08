// Zustand store for the visual-artifact UI.
// Holds only display-side state (demo flag, privacy toggle). The live
// demo runs inside Po — no FHIR creds or assessment results are stored
// here.

import { create } from 'zustand';

interface PreOpStore {
  isDemoMode: boolean;
  privacyMode: boolean;

  enableDemoMode: () => void;
  togglePrivacyMode: () => void;
  reset: () => void;
}

export const usePreOpStore = create<PreOpStore>((set) => ({
  isDemoMode: false,
  privacyMode: true,

  enableDemoMode: () => set({ isDemoMode: true }),

  togglePrivacyMode: () =>
    set((state) => ({ privacyMode: !state.privacyMode })),

  reset: () =>
    set({
      isDemoMode: false,
      privacyMode: true,
    }),
}));
