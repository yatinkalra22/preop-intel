// Zustand store for global app state.
// Why Zustand (not Redux)? 1.2kB vs 11kB. No boilerplate (actions, reducers,
// providers). Works with Server Components without a Context provider.
// Source: https://zustand-demo.pmnd.rs/

import { create } from 'zustand';
import type { AssessmentResult } from '@preop-intel/shared';

interface PreOpStore {
  // SMART on FHIR context
  fhirToken: string | null;
  fhirBaseUrl: string | null;
  patientId: string | null;

  // Assessment
  currentAssessmentId: string | null;
  assessmentResult: AssessmentResult | null;

  // Demo mode
  isDemoMode: boolean;

  // Actions
  setFhirContext: (token: string, baseUrl: string, patientId: string) => void;
  setAssessmentId: (id: string) => void;
  setAssessmentResult: (result: AssessmentResult) => void;
  enableDemoMode: () => void;
  reset: () => void;
}

export const usePreOpStore = create<PreOpStore>((set) => ({
  fhirToken: null,
  fhirBaseUrl: null,
  patientId: null,
  currentAssessmentId: null,
  assessmentResult: null,
  isDemoMode: false,

  setFhirContext: (token, baseUrl, patientId) =>
    set({ fhirToken: token, fhirBaseUrl: baseUrl, patientId }),

  setAssessmentId: (id) =>
    set({ currentAssessmentId: id }),

  setAssessmentResult: (result) =>
    set({ assessmentResult: result }),

  enableDemoMode: () =>
    set({
      isDemoMode: true,
      patientId: 'demo-patient-001',
      fhirBaseUrl: 'demo',
      fhirToken: 'demo-token',
    }),

  reset: () =>
    set({
      fhirToken: null,
      fhirBaseUrl: null,
      patientId: null,
      currentAssessmentId: null,
      assessmentResult: null,
      isDemoMode: false,
    }),
}));
