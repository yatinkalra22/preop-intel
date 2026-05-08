// Pure deterministic core used by the A2A v1 executor.
//
// Everything in this file was previously spread across modules/risk/* and
// modules/agents/* as NestJS @Injectable services. After dropping the
// standalone NestJS path, the executor needs the same logic without the
// framework decorators. Verbatim except for stripped @Injectable and the
// removal of the LLM-driven action-plan generator (Po BYO action-plan
// agent owns that prompt now — see docs/po-agents/action-plan.system.md).

import {
  ARISCAT_CUTOFFS,
  FINDING_CONFIDENCE,
  RCRI_RISK_MAP,
  SEVERITY_COST_CONTRIBUTION,
  SEVERITY_SCORE_WEIGHT,
  SURGERY_COST_PROFILES,
  type AriscatInput,
  type AriscatResult,
  type CancellationScoreInput,
  type ClinicalDocument,
  type ClinicalFinding,
  type FieldOverride,
  type FindingCategory,
  type MetabolicRiskData,
  type PreventableIssue,
  type RcriInput,
  type RcriResult,
} from '@preop-intel/shared';

// ─── RCRI / ARISCAT calculators ──────────────────────────────────────────────

export function calculateRcri(input: RcriInput): RcriResult {
  const score = Object.values(input).filter(Boolean).length;
  const risk = score >= 3
    ? { percent: 11, category: 'High' as const }
    : RCRI_RISK_MAP[score];

  const activeFactors = Object.entries(input)
    .filter(([, v]) => v)
    .map(([k]) => k);

  let interpretation: string;
  if (score === 0) interpretation = 'Very low cardiac risk. Proceed with surgery.';
  else if (score === 1) interpretation = `Low cardiac risk (${risk.percent}%). Active factor: ${activeFactors.join(', ')}.`;
  else if (score === 2) interpretation = `Moderate cardiac risk (${risk.percent}%). Consider cardiology review. Active factors: ${activeFactors.join(', ')}.`;
  else interpretation = `High cardiac risk (${risk.percent}%). Cardiology consultation recommended. Active factors: ${activeFactors.join(', ')}.`;

  return { score, criteria: input, riskPercent: risk.percent, riskCategory: risk.category, interpretation };
}

export function calculateAriscat(input: AriscatInput): AriscatResult {
  let score = 0;

  if (input.age >= 51 && input.age <= 80) score += 3;
  else if (input.age > 80) score += 16;

  if (input.spo2Preop >= 91 && input.spo2Preop <= 95) score += 8;
  else if (input.spo2Preop <= 90) score += 24;

  if (input.respiratoryInfectionLastMonth) score += 17;
  if (input.preopHemoglobin <= 10) score += 11;

  if (input.surgicalIncisionSite === 'upper_abdominal') score += 15;
  else if (input.surgicalIncisionSite === 'intrathoracic') score += 24;

  if (input.surgeryDurationHours >= 2 && input.surgeryDurationHours < 3) score += 16;
  else if (input.surgeryDurationHours >= 3) score += 23;

  if (input.emergencySurgery) score += 8;

  let riskCategory: AriscatResult['riskCategory'];
  let ppcRisk: string;
  if (score < 26) { riskCategory = 'Low'; ppcRisk = ARISCAT_CUTOFFS.Low.ppcRisk; }
  else if (score <= 44) { riskCategory = 'Intermediate'; ppcRisk = ARISCAT_CUTOFFS.Intermediate.ppcRisk; }
  else { riskCategory = 'High'; ppcRisk = ARISCAT_CUTOFFS.High.ppcRisk; }

  const recommendations: string[] = [];
  if (input.spo2Preop <= 95) recommendations.push('Optimize oxygenation pre-operatively');
  if (input.respiratoryInfectionLastMonth) recommendations.push('Consider delaying elective surgery until infection resolved (min 4 weeks)');
  if (input.preopHemoglobin <= 10) recommendations.push('Evaluate and treat anemia before surgery');
  if (riskCategory === 'High') recommendations.push('Pulmonology consultation recommended', 'Consider lung-protective ventilation strategy');
  if (riskCategory === 'Intermediate') recommendations.push('Incentive spirometry training pre-operatively');

  return { score, riskCategory, ppcRisk, recommendations };
}

// ─── Findings routing & application (cardiac / pulmonary / metabolic) ───────

const RECENT_MI_KEYWORDS = /\b(NSTEMI|STEMI|myocardial infarction|MI)\b/i;
const RECENT_TIMEFRAME_KEYWORDS = /\b(weeks ago|days ago|recent|this admission|on this admission)\b/i;
const METS_KEYWORDS = /\bMETs?\b.*\b(<\s*4|below 4|less than 4)\b|\b(below 4 METs|<4 METs)\b/i;
const DYSPNEA_KEYWORDS = /dyspne(ic|a) at one block|walker.*dyspne|ambulates with walker/i;
const RECENT_RESPIRATORY_INFECTION_KEYWORDS = /\b(pneumonia|URI|bronchitis|respiratory infection)\b.*\b(this month|last month|past month|recent)\b/i;

export type SpecialistDomain = 'cardiac' | 'pulmonary' | 'metabolic';

const DOMAIN_CATEGORIES: Record<SpecialistDomain, FindingCategory[]> = {
  cardiac:   ['cardiac-event', 'medication', 'functional'],
  pulmonary: ['respiratory', 'functional'],
  metabolic: ['metabolic', 'medication'],
};

export function routeFindingsToSpecialist(
  findings: ClinicalFinding[],
  domain: SpecialistDomain,
): ClinicalFinding[] {
  const categories = DOMAIN_CATEGORIES[domain];
  return findings.filter(f => categories.includes(f.category));
}

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

// ─── Cancellation risk (deterministic) ──────────────────────────────────────

export function computeCancellationScore(input: CancellationScoreInput): {
  score: number;
  severityCounts: Record<'low' | 'moderate' | 'high' | 'critical', number>;
  daysToSurgeryMultiplier: number;
} {
  const severityCounts = countBySeverity(input.findings);

  const rawScore =
    severityCounts.low * SEVERITY_SCORE_WEIGHT.low
    + severityCounts.moderate * SEVERITY_SCORE_WEIGHT.moderate
    + severityCounts.high * SEVERITY_SCORE_WEIGHT.high
    + severityCounts.critical * SEVERITY_SCORE_WEIGHT.critical;

  const daysToSurgeryMultiplier = urgencyMultiplier(input.daysToSurgery);
  const score = Math.min(100, Math.round(rawScore * daysToSurgeryMultiplier));

  return { score, severityCounts, daysToSurgeryMultiplier };
}

export function computeCostBand(input: CancellationScoreInput): {
  low: number;
  high: number;
  profile: ReturnType<typeof getProfile>;
} {
  const profile = getProfile(input.surgeryType);

  const findingsLow = input.findings.reduce(
    (sum, f) => sum + SEVERITY_COST_CONTRIBUTION[f.severity].low,
    0,
  );
  const findingsHigh = input.findings.reduce(
    (sum, f) => sum + SEVERITY_COST_CONTRIBUTION[f.severity].high,
    0,
  );

  const orRescheduleLow = profile.orHourRateLow * profile.estimatedOrHours * 0.4;
  const orRescheduleHigh = profile.orHourRateHigh * profile.estimatedOrHours * 0.6;

  const urgencyMult = urgencyMultiplier(input.daysToSurgery);

  const low = Math.round((profile.baseCancellationOverhead + findingsLow + orRescheduleLow) * urgencyMult);
  const high = Math.round((profile.baseCancellationOverhead + findingsHigh + orRescheduleHigh) * urgencyMult);

  return { low, high, profile };
}

export function derivePreventableIssues(
  findings: ClinicalFinding[],
  daysToSurgery: number,
): PreventableIssue[] {
  return findings
    .filter(f => f.severity !== 'low')
    .map(f => ({
      id: `issue-${f.id}`,
      issue: f.finding,
      daysToFix: estimateDaysToFix(f.severity, daysToSurgery),
      owner: ownerForCategory(f.category),
      action: f.riskImplication,
      sourceFindingId: f.id,
    }));
}

function countBySeverity(findings: ClinicalFinding[]) {
  const out = { low: 0, moderate: 0, high: 0, critical: 0 };
  for (const f of findings) out[f.severity] += 1;
  return out;
}

function urgencyMultiplier(daysToSurgery: number): number {
  if (daysToSurgery <= 1) return 1.5;
  if (daysToSurgery <= 3) return 1.3;
  if (daysToSurgery <= 7) return 1.1;
  return 1.0;
}

function getProfile(surgeryType: string) {
  return SURGERY_COST_PROFILES[surgeryType] ?? SURGERY_COST_PROFILES.default;
}

function estimateDaysToFix(severity: ClinicalFinding['severity'], daysToSurgery: number): number {
  const ideal = severity === 'critical' ? 1 : severity === 'high' ? 3 : 7;
  return Math.min(ideal, Math.max(1, daysToSurgery - 1));
}

function ownerForCategory(category: FindingCategory): PreventableIssue['owner'] {
  switch (category) {
    case 'medication':    return 'anesthesia';
    case 'cardiac-event': return 'cardiology';
    case 'functional':    return 'cardiology';
    case 'respiratory':   return 'primary-care';
    case 'metabolic':     return 'endocrinology';
    default:              return 'surgery';
  }
}

// ─── Verifier (defensive: drop findings whose snippets are not verbatim) ────
//
// The Po note-extractor BYO agent already promises verbatim snippets; this is
// a second, deterministic line of defense. If documents are passed alongside
// findings, we re-validate before applying. If documents are not provided, we
// trust the upstream agent and skip verification.

const SNIPPET_MIN = 5;
const SNIPPET_MAX = 300;
const MED_STATUS_KEYWORDS = /\b(stop|stopped|discontinu|hold|held|paused|paus|off)\b/i;

export interface RawFinding {
  id: string;
  finding: string;
  category: FindingCategory;
  riskImplication: string;
  guidelineRef?: string;
  sourceDocumentId: string;
  sourceSnippet: string;
  confidence: number;
  severity: 'low' | 'moderate' | 'high' | 'critical';
}

export function verifyAndGateFindings(
  raw: RawFinding[],
  documents: ClinicalDocument[],
  categoryFilter?: FindingCategory[],
): { kept: ClinicalFinding[]; rejectedCount: number; rejectionReasons: string[] } {
  const docMap = new Map(documents.map(d => [d.id, d]));
  const kept: ClinicalFinding[] = [];
  const rejectionReasons: string[] = [];
  let rejectedCount = 0;

  for (const r of raw) {
    const doc = docMap.get(r.sourceDocumentId);
    if (!doc) {
      rejectionReasons.push(`Dropping finding "${r.id}": unknown sourceDocumentId ${r.sourceDocumentId}`);
      rejectedCount += 1;
      continue;
    }

    const snippetOk =
      typeof r.sourceSnippet === 'string'
      && r.sourceSnippet.length >= SNIPPET_MIN
      && r.sourceSnippet.length <= SNIPPET_MAX
      && doc.text.includes(r.sourceSnippet);

    if (!snippetOk) {
      rejectionReasons.push(`Dropping finding "${r.id}": snippet not found verbatim in ${r.sourceDocumentId}`);
      rejectedCount += 1;
      continue;
    }

    const confidence = clamp01(r.confidence);
    if (confidence < FINDING_CONFIDENCE.HIDE_BELOW) {
      rejectedCount += 1;
      continue;
    }

    if (categoryFilter && !categoryFilter.includes(r.category)) {
      continue;
    }

    const isStatusChangeMed =
      r.category === 'medication'
      && MED_STATUS_KEYWORDS.test(`${r.finding} ${r.sourceSnippet}`);

    const displayState = isStatusChangeMed
      ? 'pending-confirmation' as const
      : confidence >= FINDING_CONFIDENCE.POSSIBLE_BELOW
        ? 'detected' as const
        : 'possible' as const;

    kept.push({
      id: r.id,
      finding: r.finding,
      category: r.category,
      riskImplication: r.riskImplication,
      guidelineRef: r.guidelineRef,
      sourceDocumentId: r.sourceDocumentId,
      sourceSnippet: r.sourceSnippet,
      confidence,
      severity: r.severity,
      displayState,
      verifiedSnippet: true,
    });
  }

  return { kept, rejectedCount, rejectionReasons };
}

function clamp01(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
