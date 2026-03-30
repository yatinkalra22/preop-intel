// Demo patient data — Robert Chen, 67M, hip arthroplasty.
// Lives in shared package so both backend and frontend can import it.
//
// Why these specific values?
// - HbA1c 9.2% triggers the >8.5% "unsafe for surgery" threshold (the wow moment)
// - RCRI 2 (IHD + DM on insulin) → Moderate cardiac risk → cardiology referral
// - ARISCAT ~19 → Low-Intermediate pulmonary risk → multi-domain assessment
// - eGFR 55 → CKD Stage 3a → adds a third concern
// See BUILD_PLAN.md Phase 11 for the demo strategy.

import type { RcriInput, MetabolicRiskData, MedicationRiskData } from '../types/risk.types.js';

export const DEMO_PATIENT = {
  id: 'demo-patient-001',
  name: 'Robert Chen',
  age: 67,
  gender: 'Male',
  birthDate: '1959-03-15',
  plannedProcedure: 'Right total hip arthroplasty',
};

export const DEMO_DATA = {
  patient: {
    id: DEMO_PATIENT.id,
    name: [{ text: DEMO_PATIENT.name }],
    birthDate: DEMO_PATIENT.birthDate,
    gender: 'male',
  },

  cardiac: {
    highRiskSurgery: false,
    ischemicHeartDisease: true,
    heartFailureHistory: false,
    cerebrovascularDisease: false,
    diabetesOnInsulin: true,
    creatinineAbove2: false,
  } satisfies RcriInput,

  pulmonary: {
    age: 67,
    spo2Value: 96,
    hemoglobinValue: 13.2,
    hasRespiratoryInfection: false,
  },

  metabolic: {
    hba1c: { value: 9.2, unit: '%', riskFlag: true },
    egfr: { value: 55, unit: 'mL/min/1.73m2', riskFlag: false },
    bmi: { value: 31.2, unit: 'kg/m2', riskFlag: false },
    creatinine: { value: 1.4, unit: 'mg/dL', riskFlag: false },
  } satisfies MetabolicRiskData,

  medication: {
    flags: [
      {
        medication: 'Insulin glargine (Lantus)',
        category: 'insulin',
        concern: 'Hypoglycemia risk during NPO period',
        recommendation: 'Reduce basal insulin dose by 50% evening before surgery',
      },
      {
        medication: 'Aspirin 81mg',
        category: 'anticoagulant',
        concern: 'Antiplatelet effect — mild bleeding risk',
        recommendation: 'Continue for cardiac-risk patients per ACC/AHA guidelines',
      },
    ],
    allergies: [
      { substance: 'Penicillin', type: 'allergy' },
    ],
  } satisfies MedicationRiskData,

  // Pre-computed results for frontend demo rendering without backend
  conditions: [
    { name: 'Type 2 Diabetes Mellitus', code: 'E11.9', status: 'active' },
    { name: 'Ischemic Heart Disease', code: 'I25.10', status: 'active' },
    { name: 'Chronic Kidney Disease Stage 3a', code: 'N18.3', status: 'active' },
  ],

  medications: [
    { name: 'Insulin glargine (Lantus) 30 units daily', status: 'active' },
    { name: 'Metformin 1000mg BID', status: 'active' },
    { name: 'Aspirin 81mg daily', status: 'active' },
    { name: 'Lisinopril 10mg daily', status: 'active' },
    { name: 'Atorvastatin 40mg daily', status: 'active' },
  ],

  allergies: [
    { substance: 'Penicillin', reaction: 'Rash' },
  ],

  recentLabs: [
    { name: 'HbA1c', value: 9.2, unit: '%', date: '2026-03-15', flag: 'high' },
    { name: 'Creatinine', value: 1.4, unit: 'mg/dL', date: '2026-03-15', flag: 'normal' },
    { name: 'eGFR', value: 55, unit: 'mL/min', date: '2026-03-15', flag: 'low' },
    { name: 'SpO2', value: 96, unit: '%', date: '2026-03-20', flag: 'normal' },
    { name: 'Hemoglobin', value: 13.2, unit: 'g/dL', date: '2026-03-15', flag: 'normal' },
    { name: 'BMI', value: 31.2, unit: 'kg/m²', date: '2026-03-20', flag: 'high' },
  ],

  // Pre-computed assessment result for instant frontend rendering
  assessmentResult: {
    overallRisk: 'High' as const,
    overallRiskPercent: 6.6,
    clinicalNarrative: 'Patient presents with moderate cardiac risk (RCRI 2/6) and poorly controlled T2DM (HbA1c 9.2%) — surgery not recommended until glycemic optimization achieved.',
    safeToProceed: false,
    optimizationRequired: true,
    urgentConcerns: [
      'HbA1c 9.2% exceeds safe threshold of 8.5% for elective surgery',
      'Moderate cardiac risk requires cardiology clearance',
    ],
    recommendations: [
      { action: 'Endocrinology referral for glycemic optimization', urgency: 'Immediate' as const, rationale: 'HbA1c 9.2% — target <8.5% before surgery' },
      { action: 'Cardiology clearance', urgency: 'Within 2 weeks' as const, rationale: 'RCRI 2/6 — 6.6% MACE risk' },
      { action: 'Pre-operative incentive spirometry training', urgency: 'Before surgery' as const, rationale: 'Intermediate pulmonary risk (ARISCAT 31)' },
    ],
    rcri: { score: 2, riskPercent: 6.6, riskCategory: 'Moderate' as const },
    ariscat: { score: 19, riskCategory: 'Low' as const, ppcRisk: '1.6%' },
  },
};
