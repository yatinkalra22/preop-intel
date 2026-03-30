import type { RcriCategory, AriscatCategory } from '../types/risk.types.js';

// ─── RCRI Risk Map ───────────────────────────────────────────────────────────
// Risk percentages from original Lee 1999 derivation cohort.
// Score 0: 0.4%, Score 1: 0.9%, Score 2: 6.6%, Score ≥3: ≥11%
// Source: Lee TH et al. Circulation. 1999;100(10):1043-1049.
// https://www.ahajournals.org/doi/10.1161/01.cir.100.10.1043

export const RCRI_RISK_MAP: Record<number, { percent: number; category: RcriCategory }> = {
  0: { percent: 0.4, category: 'Very Low' },
  1: { percent: 0.9, category: 'Low' },
  2: { percent: 6.6, category: 'Moderate' },
  3: { percent: 11, category: 'High' },
};

// ─── ARISCAT Cutoffs ─────────────────────────────────────────────────────────
// Risk stratification from original Canet 2010 validation.
// Source: Canet J et al. Anesthesiology. 2010;113(6):1338-1350.
// https://pubs.asahq.org/anesthesiology/article/113/6/1338/10737

export const ARISCAT_CUTOFFS: Record<AriscatCategory, { maxScore?: number; minScore?: number; ppcRisk: string }> = {
  Low: { maxScore: 25, ppcRisk: '1.6%' },
  Intermediate: { maxScore: 44, minScore: 26, ppcRisk: '13.3%' },
  High: { minScore: 45, ppcRisk: '42.1%' },
};

// ─── Metabolic Thresholds ────────────────────────────────────────────────────
// HbA1c threshold: ADA Standards of Care 2024, Section 16 — Diabetes Care in
// the Hospital. Elective surgery should be postponed if A1C > 8.5%.
// Source: https://diabetesjournals.org/care/article/47/Supplement_1/S1/153952

export const METABOLIC_THRESHOLDS = {
  /** % — postpone elective surgery above this (ADA 2024) */
  HBA1C_UNSAFE: 8.5,

  /** mL/min/1.73m² — severe renal risk below this (CKD Stage 4-5) */
  EGFR_SEVERE: 30,

  /** kg/m² — morbid obesity, elevated surgical risk */
  BMI_MORBID_OBESITY: 40,

  /** kg/m² — underweight, elevated surgical risk */
  BMI_UNDERWEIGHT: 18.5,

  /** mg/dL — RCRI criteria threshold (Lee 1999) */
  CREATININE_HIGH: 2.0,
} as const;

// ─── ICD-10 Code Prefixes ────────────────────────────────────────────────────
// Why prefix matching? ICD-10 codes have subcategories (I25.1, I25.10, I25.110).
// Prefix matching captures all subcategories without maintaining exhaustive lists.

export const ICD10_RCRI = {
  /** Ischemic heart disease: I20 (angina) through I25 (chronic IHD) */
  ISCHEMIC_HEART_DISEASE: ['I20', 'I21', 'I22', 'I23', 'I24', 'I25'],

  /** Heart failure: I50 and subcategories */
  HEART_FAILURE: ['I50'],

  /** Cerebrovascular disease: I60-I69 (stroke), G45 (TIA) */
  CEREBROVASCULAR_DISEASE: ['I60', 'I61', 'I62', 'I63', 'I64', 'I65', 'I66', 'I67', 'I69', 'G45'],

  /** Diabetes mellitus: E10 (T1DM), E11 (T2DM), E13 (other DM) */
  DIABETES: ['E10', 'E11', 'E13'],
} as const;

// ─── SNOMED Codes ────────────────────────────────────────────────────────────
// Used in FHIR write-back tools for ServiceRequest specialty coding.
// Source: https://browser.ihtsdotools.org/

export const SNOMED_SPECIALTIES = {
  cardiology: { code: '394579002', display: 'Cardiology' },
  endocrinology: { code: '394585009', display: 'Endocrinology' },
  pulmonology: { code: '418112009', display: 'Pulmonology' },
  nephrology: { code: '394589003', display: 'Nephrology' },
} as const;

export const SNOMED_RISK_ASSESSMENT = {
  code: '225338004',
  display: 'Risk assessment',
  system: 'http://snomed.info/sct',
} as const;

// ─── Respiratory Infection ICD-10 Codes ──────────────────────────────────────
// Used by ARISCAT to detect recent respiratory infection.

export const ICD10_RESPIRATORY_INFECTION = [
  'J00', 'J01', 'J02', 'J03', 'J04', 'J05', 'J06', // Upper respiratory
  'J20', 'J22',                                       // Lower respiratory
] as const;
