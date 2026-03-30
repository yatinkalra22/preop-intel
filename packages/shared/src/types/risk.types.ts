// ─── RCRI (Revised Cardiac Risk Index) ───────────────────────────────────────
// Source: Lee TH et al. Circulation. 1999;100(10):1043-1049.
// https://www.ahajournals.org/doi/10.1161/01.cir.100.10.1043

export interface RcriInput {
  highRiskSurgery: boolean;        // Suprainguinal vascular, intrathoracic, intraperitoneal
  ischemicHeartDisease: boolean;   // Hx MI, positive stress test, angina, nitrate use, ECG Q waves
  heartFailureHistory: boolean;    // Hx CHF, pulmonary edema, PND, bilateral rales, S3 gallop
  cerebrovascularDisease: boolean; // Hx stroke or TIA
  diabetesOnInsulin: boolean;      // Pre-op insulin use
  creatinineAbove2: boolean;       // Pre-op creatinine > 2.0 mg/dL
}

export type RcriCategory = 'Very Low' | 'Low' | 'Moderate' | 'High';

export interface RcriResult {
  score: number;
  criteria: RcriInput;
  riskPercent: number;
  riskCategory: RcriCategory;
  interpretation: string;
}

// ─── ARISCAT (Assess Respiratory Risk in Surgical Patients in Catalonia) ─────
// Source: Canet J et al. Anesthesiology. 2010;113(6):1338-1350.
// https://pubs.asahq.org/anesthesiology/article/113/6/1338/10737

export type SurgicalIncisionSite = 'peripheral' | 'upper_abdominal' | 'intrathoracic';

export interface AriscatInput {
  age: number;                                    // Years
  spo2Preop: number;                              // % peripheral oxygen saturation
  respiratoryInfectionLastMonth: boolean;
  preopHemoglobin: number;                        // g/dL
  surgicalIncisionSite: SurgicalIncisionSite;
  surgeryDurationHours: number;                   // Hours
  emergencySurgery: boolean;
}

export type AriscatCategory = 'Low' | 'Intermediate' | 'High';

export interface AriscatResult {
  score: number;
  riskCategory: AriscatCategory;
  ppcRisk: string;
  recommendations: string[];
}

// ─── Metabolic Risk ──────────────────────────────────────────────────────────

export interface MetabolicRiskData {
  hba1c: { value: number | null; unit: string; riskFlag: boolean };
  egfr: { value: number | null; unit: string; riskFlag: boolean };
  bmi: { value: number | null; unit: string; riskFlag: boolean };
  creatinine: { value: number | null; unit: string; riskFlag: boolean };
}

// ─── Medication Risk ─────────────────────────────────────────────────────────

export interface MedicationRiskFlag {
  medication: string;
  category: 'anticoagulant' | 'nsaid' | 'insulin' | 'supplement' | 'other';
  concern: string;
  recommendation: string;
}

export interface MedicationRiskData {
  flags: MedicationRiskFlag[];
  allergies: Array<{ substance: string; type?: string }>;
}

// ─── Overall Risk Assessment ─────────────────────────────────────────────────

export type OverallRiskLevel = 'Low' | 'Moderate' | 'High' | 'Very High';

export interface RiskRecommendation {
  action: string;
  urgency: 'Immediate' | 'Within 2 weeks' | 'Before surgery';
  rationale: string;
}

export interface OverallRiskAssessment {
  overallRisk: OverallRiskLevel;
  overallRiskPercent: number;
  clinicalNarrative: string;
  safeToProceed: boolean;
  optimizationRequired: boolean;
  urgentConcerns: string[];
  recommendations: RiskRecommendation[];
}
