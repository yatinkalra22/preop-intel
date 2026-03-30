// Types
export type {
  FhirPatient,
  FhirCondition,
  FhirObservation,
  FhirMedicationRequest,
  FhirProcedure,
  FhirDiagnosticReport,
  FhirAllergyIntolerance,
  FhirReference,
  FhirCoding,
  FhirRiskAssessment,
  FhirCarePlan,
  FhirGoal,
  FhirFlag,
  FhirServiceRequest,
  FhirBundle,
} from './types/fhir.types.js';

export type {
  RcriInput,
  RcriCategory,
  RcriResult,
  SurgicalIncisionSite,
  AriscatInput,
  AriscatCategory,
  AriscatResult,
  MetabolicRiskData,
  MedicationRiskFlag,
  MedicationRiskData,
  OverallRiskLevel,
  RiskRecommendation,
  OverallRiskAssessment,
} from './types/risk.types.js';

export type {
  AgentName,
  AgentStatus,
  AgentStatusUpdate,
  AssessmentStatus,
  FhirWriteResults,
  AssessmentResult,
  StartAssessmentRequest,
} from './types/agent.types.js';

// Constants
export { LOINC } from './constants/loinc.constants.js';
export type { LoincCode } from './constants/loinc.constants.js';

export {
  RCRI_RISK_MAP,
  ARISCAT_CUTOFFS,
  METABOLIC_THRESHOLDS,
  ICD10_RCRI,
  SNOMED_SPECIALTIES,
  SNOMED_RISK_ASSESSMENT,
  ICD10_RESPIRATORY_INFECTION,
} from './constants/risk.constants.js';

// Mock / Demo data
export { DEMO_DATA, DEMO_PATIENT } from './mock/demo-data.js';
