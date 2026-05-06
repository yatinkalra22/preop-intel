// Cancellation-risk types and the deterministic cost lookup table.
//
// Score and cost are rules-based (auditable line items, citable).
// Action plan is AI-generated narrative produced separately.
//
// Cost bands cite: Macario A. Anesthesiol Clin. 2010;28(4):557-571 — average
// total cost of an operating room minute is $36-$37 in 2010 USD; we use
// $1,500-$15,000+ per cancelled case as the literature range, with surgery-type
// multipliers below. Argo JL et al. Am J Surg. 2009 reports OR-hour costs of
// $1,430-$1,700 in cardiac/vascular settings.

import type { ClinicalFinding } from './note.types.js';

// ─── Cancellation Risk ────────────────────────────────────────────────────────

export interface PreventableIssue {
  id: string;
  issue: string;
  daysToFix: number;
  owner: 'anesthesia' | 'surgery' | 'patient' | 'primary-care' | 'cardiology' | 'endocrinology';
  action: string;
  sourceFindingId?: string;
}

export interface CancellationRisk {
  score: number;
  estimatedCostAvoidanceLow: number;
  estimatedCostAvoidanceHigh: number;
  preventableIssues: PreventableIssue[];
  actionPlan: string;
  inputs: {
    findingCount: number;
    severityCounts: Record<'low' | 'moderate' | 'high' | 'critical', number>;
    daysToSurgery: number;
    surgeryType: string;
    orHourRateLow: number;
    orHourRateHigh: number;
    estimatedOrHours: number;
  };
}

// ─── Override Provenance Trail ────────────────────────────────────────────────
// Recorded when a note finding modifies a value derived from structured FHIR data.
// Surfaced in the UI, written into the FHIR resource as a SHARP evidence-link.

export interface FieldOverride {
  field: string;
  structuredValue: unknown;
  noteValue: unknown;
  findingId: string;
  resolution: 'note-wins' | 'pending-confirmation' | 'structured-wins';
  reason: string;
}

// ─── Surgery Type Cost Lookup ─────────────────────────────────────────────────
// OR-hour rate band per surgery class. Numbers are 2024 USD; rate is total
// facility cost (staff + supplies + space) per OR hour, not professional fees.
// Conservative defaults; refine per institution in production.

export interface SurgeryCostProfile {
  orHourRateLow: number;
  orHourRateHigh: number;
  estimatedOrHours: number;
  baseCancellationOverhead: number;
}

export const SURGERY_COST_PROFILES: Record<string, SurgeryCostProfile> = {
  'hip-arthroplasty': {
    orHourRateLow: 2200,
    orHourRateHigh: 3800,
    estimatedOrHours: 2.5,
    baseCancellationOverhead: 1200,
  },
  'knee-arthroplasty': {
    orHourRateLow: 2200,
    orHourRateHigh: 3800,
    estimatedOrHours: 2.0,
    baseCancellationOverhead: 1200,
  },
  'cardiac-bypass': {
    orHourRateLow: 4500,
    orHourRateHigh: 6500,
    estimatedOrHours: 4.0,
    baseCancellationOverhead: 3500,
  },
  'general-abdominal': {
    orHourRateLow: 1800,
    orHourRateHigh: 3000,
    estimatedOrHours: 2.0,
    baseCancellationOverhead: 900,
  },
  default: {
    orHourRateLow: 2000,
    orHourRateHigh: 3500,
    estimatedOrHours: 2.0,
    baseCancellationOverhead: 1000,
  },
};

// ─── Severity → Cost Contribution ─────────────────────────────────────────────
// Per-finding contribution to the cancellation cost band, before OR-hour scaling.
// Reflects both the probability the finding causes a cancellation and the
// downstream rescheduling cost (patient bowel prep, pre-op meds, NPO, etc.).

export const SEVERITY_COST_CONTRIBUTION: Record<
  'low' | 'moderate' | 'high' | 'critical',
  { low: number; high: number }
> = {
  low: { low: 0, high: 200 },
  moderate: { low: 400, high: 1200 },
  high: { low: 1500, high: 3500 },
  critical: { low: 3000, high: 6000 },
};

// ─── Severity → Cancellation Probability Weight ───────────────────────────────
// Used by the deterministic score computation. Capped at 100.

export const SEVERITY_SCORE_WEIGHT: Record<
  'low' | 'moderate' | 'high' | 'critical',
  number
> = {
  low: 5,
  moderate: 12,
  high: 25,
  critical: 40,
};

// ─── Inputs for the Cancellation Score Computation ────────────────────────────

export interface CancellationScoreInput {
  findings: ClinicalFinding[];
  daysToSurgery: number;
  surgeryType: keyof typeof SURGERY_COST_PROFILES;
}
