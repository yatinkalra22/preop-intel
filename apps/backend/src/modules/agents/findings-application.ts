// Applies routed findings to specialist inputs, emitting:
//   - adjustedInput (RCRI/ARISCAT/metabolic) when a finding overrides structured data,
//   - overrides[] provenance trail (for SHARP evidence-link extension on FHIR write-back),
//   - criticalAlerts[] human-readable strings (fed to the orchestrator LLM synthesis).
//
// Conflict resolution rules per spec §4.4:
//   - confidence ≥ 0.85 + recency-favors-notes → note overrides structured data,
//   - medication-status changes (active ↔ discontinued) always require explicit
//     clinician confirmation regardless of confidence (handled upstream as
//     displayState='pending-confirmation' on the finding; we do NOT override
//     structured medication status here, only surface as alert).

import {
  FINDING_CONFIDENCE,
  type AriscatInput,
  type ClinicalFinding,
  type FieldOverride,
  type MetabolicRiskData,
  type RcriInput,
} from '@preop-intel/shared';

const RECENT_MI_KEYWORDS = /\b(NSTEMI|STEMI|myocardial infarction|MI)\b/i;
const RECENT_TIMEFRAME_KEYWORDS = /\b(weeks ago|days ago|recent|this admission|on this admission)\b/i;
const METS_KEYWORDS = /\bMETs?\b.*\b(<\s*4|below 4|less than 4)\b|\b(below 4 METs|<4 METs)\b/i;
const DYSPNEA_KEYWORDS = /dyspne(ic|a) at one block|walker.*dyspne|ambulates with walker/i;
const RECENT_RESPIRATORY_INFECTION_KEYWORDS = /\b(pneumonia|URI|bronchitis|respiratory infection)\b.*\b(this month|last month|past month|recent)\b/i;

export interface CardiacSpecialistOutput {
  adjustedInput: RcriInput;
  overrides: FieldOverride[];
  criticalAlerts: string[];
  findingsApplied: ClinicalFinding[];
}

export interface PulmonarySpecialistOutput {
  adjustedInput: AriscatInput;
  overrides: FieldOverride[];
  criticalAlerts: string[];
  findingsApplied: ClinicalFinding[];
}

export interface MetabolicSpecialistOutput {
  adjustedInput: MetabolicRiskData;
  overrides: FieldOverride[];
  criticalAlerts: string[];
  findingsApplied: ClinicalFinding[];
}

// ─── Cardiac ──────────────────────────────────────────────────────────────────

export function applyFindingsToCardiac(
  structured: RcriInput,
  findings: ClinicalFinding[],
): CardiacSpecialistOutput {
  const overrides: FieldOverride[] = [];
  const criticalAlerts: string[] = [];
  const findingsApplied: ClinicalFinding[] = [];

  let adjusted: RcriInput = { ...structured };

  for (const f of findings) {
    if (f.category === 'cardiac-event' && isRecentMI(f)) {
      findingsApplied.push(f);
      const guideline = f.guidelineRef ?? 'ACC/AHA 2014 perioperative guideline — recent MI <60d';
      criticalAlerts.push(
        `Recent MI/NSTEMI extracted from notes (severity: ${f.severity}). ${guideline}: defer elective non-cardiac surgery 60 days when reasonable.`,
      );

      if (!structured.ischemicHeartDisease && f.confidence >= FINDING_CONFIDENCE.POSSIBLE_BELOW) {
        adjusted = { ...adjusted, ischemicHeartDisease: true };
        overrides.push({
          field: 'rcri.ischemicHeartDisease',
          structuredValue: false,
          noteValue: true,
          findingId: f.id,
          resolution: 'note-wins',
          reason: `Recent MI in notes not present in structured Condition list (confidence ${f.confidence.toFixed(2)})`,
        });
      }
    } else if (f.category === 'medication' && f.displayState === 'pending-confirmation') {
      findingsApplied.push(f);
      criticalAlerts.push(
        `Medication status change in notes (requires clinician confirmation): ${f.finding}. ${f.riskImplication}`,
      );
    } else if (f.category === 'functional' && isReducedFunctionalCapacity(f)) {
      findingsApplied.push(f);
      const guideline = f.guidelineRef ?? 'ACC/AHA 2014 perioperative guideline';
      criticalAlerts.push(
        `Functional capacity below 4 METs extracted from notes. ${guideline}: consider non-invasive cardiac stress testing pre-op.`,
      );
    }
  }

  return { adjustedInput: adjusted, overrides, criticalAlerts, findingsApplied };
}

// ─── Pulmonary ────────────────────────────────────────────────────────────────

export function applyFindingsToPulmonary(
  structured: AriscatInput,
  findings: ClinicalFinding[],
): PulmonarySpecialistOutput {
  const overrides: FieldOverride[] = [];
  const criticalAlerts: string[] = [];
  const findingsApplied: ClinicalFinding[] = [];

  let adjusted: AriscatInput = { ...structured };

  for (const f of findings) {
    if (f.category === 'respiratory' && isRecentRespiratoryInfection(f)) {
      findingsApplied.push(f);
      if (!structured.respiratoryInfectionLastMonth && f.confidence >= FINDING_CONFIDENCE.POSSIBLE_BELOW) {
        adjusted = { ...adjusted, respiratoryInfectionLastMonth: true };
        overrides.push({
          field: 'ariscat.respiratoryInfectionLastMonth',
          structuredValue: false,
          noteValue: true,
          findingId: f.id,
          resolution: 'note-wins',
          reason: `Recent respiratory infection in notes (confidence ${f.confidence.toFixed(2)})`,
        });
      }
      criticalAlerts.push(
        `Recent respiratory infection from notes (severity: ${f.severity}). Increases ARISCAT risk for postoperative pulmonary complications.`,
      );
    } else if (f.category === 'functional' && isReducedFunctionalCapacity(f)) {
      findingsApplied.push(f);
      criticalAlerts.push(
        `Functional capacity below 4 METs may also impair pulmonary recovery; encourage incentive spirometry and early mobilization plan.`,
      );
    }
  }

  return { adjustedInput: adjusted, overrides, criticalAlerts, findingsApplied };
}

// ─── Metabolic ────────────────────────────────────────────────────────────────

export function applyFindingsToMetabolic(
  structured: MetabolicRiskData,
  findings: ClinicalFinding[],
): MetabolicSpecialistOutput {
  const overrides: FieldOverride[] = [];
  const criticalAlerts: string[] = [];
  const findingsApplied: ClinicalFinding[] = [];

  for (const f of findings) {
    if (f.category === 'metabolic' && f.severity !== 'low') {
      findingsApplied.push(f);
      criticalAlerts.push(
        `Metabolic finding from notes (severity: ${f.severity}): ${f.finding}. ${f.riskImplication}`,
      );
    }
  }

  return { adjustedInput: structured, overrides, criticalAlerts, findingsApplied };
}

// ─── Heuristics ───────────────────────────────────────────────────────────────

function isRecentMI(f: ClinicalFinding): boolean {
  const haystack = `${f.finding} ${f.sourceSnippet} ${f.riskImplication}`;
  return RECENT_MI_KEYWORDS.test(haystack) && RECENT_TIMEFRAME_KEYWORDS.test(haystack);
}

function isReducedFunctionalCapacity(f: ClinicalFinding): boolean {
  const haystack = `${f.finding} ${f.sourceSnippet} ${f.riskImplication}`;
  return METS_KEYWORDS.test(haystack) || DYSPNEA_KEYWORDS.test(haystack);
}

function isRecentRespiratoryInfection(f: ClinicalFinding): boolean {
  const haystack = `${f.finding} ${f.sourceSnippet} ${f.riskImplication}`;
  return RECENT_RESPIRATORY_INFECTION_KEYWORDS.test(haystack);
}
