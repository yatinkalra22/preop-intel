import type { RcriResult, AriscatResult, MetabolicRiskData, MedicationRiskData, RiskRecommendation } from './risk.types.js';
import type { ClinicalFinding } from './note.types.js';

// ─── Agent Status ────────────────────────────────────────────────────────────

export type AgentName = 'note-extractor' | 'cardiac' | 'pulmonary' | 'metabolic' | 'orchestrator';
export type AgentStatus = 'idle' | 'running' | 'complete' | 'error';

export interface AgentStatusUpdate {
  agentName: AgentName;
  status: AgentStatus;
  result?: string;
  durationMs?: number;
  error?: string;
}

// ─── Assessment Session ──────────────────────────────────────────────────────

export type AssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface FhirWriteResults {
  riskAssessmentId?: string;
  carePlanId?: string;
  goalIds?: string[];
  flagId?: string;
  serviceRequestIds?: string[];
}

export interface AssessmentResult {
  id: string;
  patientId: string;
  overallRisk: 'Low' | 'Moderate' | 'High' | 'Very High';
  overallRiskPercent: number;
  clinicalNarrative: string;
  safeToProceed: boolean;
  optimizationRequired: boolean;
  urgentConcerns: string[];
  recommendations: RiskRecommendation[];
  rcri: RcriResult;
  ariscat: AriscatResult;
  metabolicRisk: MetabolicRiskData;
  medicationRisk: MedicationRiskData;
  fhirWriteResults: FhirWriteResults;
  findings?: ClinicalFinding[];
}

// ─── Assessment Start Request ────────────────────────────────────────────────

export interface StartAssessmentRequest {
  patientId: string;
  fhirBaseUrl: string;
  accessToken: string;
  plannedProcedure: string;
}
