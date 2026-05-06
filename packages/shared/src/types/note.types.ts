// Clinical document and note-extracted finding types.
// Used by the get_clinical_documents MCP tool, the note-extractor agent,
// and any specialist that consumes routed findings via A2A.

// ─── Clinical Document ────────────────────────────────────────────────────────

export interface ClinicalDocument {
  id: string;
  type: string;
  typeCode?: string;
  date: string;
  author?: string;
  sourceOrg?: string;
  text: string;
}

// ─── Clinical Finding ─────────────────────────────────────────────────────────

export type FindingCategory =
  | 'medication'
  | 'functional'
  | 'cardiac-event'
  | 'respiratory'
  | 'metabolic'
  | 'other';

export type FindingSeverity = 'low' | 'moderate' | 'high' | 'critical';

export type FindingDisplayState = 'detected' | 'possible' | 'pending-confirmation' | 'hidden';

export interface ClinicalFinding {
  id: string;
  finding: string;
  category: FindingCategory;
  riskImplication: string;
  guidelineRef?: string;
  sourceDocumentId: string;
  sourceSnippet: string;
  confidence: number;
  severity: FindingSeverity;
  displayState?: FindingDisplayState;
  verifiedSnippet?: boolean;
}

// ─── Note-Extractor Agent I/O ─────────────────────────────────────────────────

export interface NoteExtractorInput {
  documents: ClinicalDocument[];
  patientContext: {
    age: number;
    sex: 'male' | 'female' | 'other' | 'unknown';
    plannedProcedure: string;
  };
  categoryFilter?: FindingCategory[];
}

export interface NoteExtractorOutput {
  findings: ClinicalFinding[];
  documentCount: number;
  durationMs: number;
  rejectedCount?: number;
}

// ─── Confidence Gating Thresholds ─────────────────────────────────────────────

export const FINDING_CONFIDENCE = {
  HIDE_BELOW: 0.6,
  POSSIBLE_BELOW: 0.85,
} as const;
