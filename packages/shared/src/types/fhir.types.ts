// Why define our own subset instead of importing `@types/fhir`?
// The full FHIR R4 type package exports 800+ types. We only use ~10 resource types.
// Subsetting keeps bundle small and gives us control over consumed fields.
// Source: https://www.hl7.org/fhir/R4/resourcelist.html

// ─── Read Resources (input to risk agents) ───────────────────────────────────

export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  name?: Array<{ text?: string; family?: string; given?: string[] }>;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
}

export interface FhirCondition {
  resourceType: 'Condition';
  id: string;
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  };
  clinicalStatus?: {
    coding?: Array<{ code?: string }>;
  };
  subject: { reference: string };
}

export interface FhirObservation {
  resourceType: 'Observation';
  id: string;
  code: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  };
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  effectiveDateTime?: string;
  subject: { reference: string };
}

export interface FhirMedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  status: 'active' | 'completed' | 'cancelled' | 'stopped';
  medicationCodeableConcept?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  subject: { reference: string };
}

export interface FhirProcedure {
  resourceType: 'Procedure';
  id: string;
  status: string;
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  };
  performedDateTime?: string;
  subject: { reference: string };
}

export interface FhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id: string;
  code: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  };
  conclusion?: string;
  subject: { reference: string };
}

export interface FhirAllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id: string;
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  type?: 'allergy' | 'intolerance';
  category?: Array<'food' | 'medication' | 'environment' | 'biologic'>;
  subject: { reference: string };
}

// ─── Write Resources (output from orchestrator agent) ────────────────────────

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirRiskAssessment {
  resourceType: 'RiskAssessment';
  id?: string;
  status: 'preliminary' | 'final' | 'amended';
  subject: FhirReference;
  occurrenceDateTime?: string;
  basis?: FhirReference[];
  prediction?: Array<{
    outcome?: { text?: string };
    probabilityDecimal?: number;
    qualitativeRisk?: { coding?: FhirCoding[] };
    whenPeriod?: { start?: string };
  }>;
  code?: { coding?: FhirCoding[] };
  note?: Array<{ text: string }>;
  extension?: Array<{ url: string; valueString?: string }>;
}

export interface FhirCarePlan {
  resourceType: 'CarePlan';
  id?: string;
  status: 'draft' | 'active' | 'completed' | 'revoked';
  intent: 'proposal' | 'plan' | 'order';
  title?: string;
  subject: FhirReference;
  period?: { start?: string; end?: string };
  goal?: FhirReference[];
  activity?: Array<{
    detail?: {
      status: 'not-started' | 'scheduled' | 'in-progress' | 'completed';
      description?: string;
    };
  }>;
}

export interface FhirGoal {
  resourceType: 'Goal';
  id?: string;
  lifecycleStatus: 'active' | 'completed' | 'cancelled';
  description: { text: string };
  subject: FhirReference;
  target?: Array<{
    measure?: { coding?: FhirCoding[] };
    detailQuantity?: {
      value?: number;
      comparator?: '<' | '<=' | '>=' | '>';
      unit?: string;
      system?: string;
      code?: string;
    };
    dueDate?: string;
  }>;
}

export interface FhirFlag {
  resourceType: 'Flag';
  id?: string;
  status: 'active' | 'inactive';
  category?: Array<{ coding?: FhirCoding[] }>;
  code: { text: string };
  subject: FhirReference;
}

export interface FhirServiceRequest {
  resourceType: 'ServiceRequest';
  id?: string;
  status: 'draft' | 'active' | 'completed';
  intent: 'proposal' | 'plan' | 'order';
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: { coding?: FhirCoding[] };
  subject: FhirReference;
  reasonCode?: Array<{ text?: string }>;
  note?: Array<{ text: string }>;
}

// ─── FHIR Bundle (search results) ───────────────────────────────────────────

export interface FhirBundle<T = any> {
  resourceType: 'Bundle';
  type: 'searchset';
  total?: number;
  entry?: Array<{
    resource: T;
  }>;
}
