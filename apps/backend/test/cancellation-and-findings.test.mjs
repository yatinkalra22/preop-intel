// Day 2 unit tests:
//   - computeCancellationScore / computeCostBand / derivePreventableIssues (pure)
//   - applyFindingsToCardiac / applyFindingsToPulmonary / applyFindingsToMetabolic (pure)
//   - routeFindingsToSpecialist
//
// Run with:  node --test apps/backend/test/cancellation-and-findings.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFindingsToCardiac,
  applyFindingsToMetabolic,
  applyFindingsToPulmonary,
  computeCancellationScore,
  computeCostBand,
  derivePreventableIssues,
  routeFindingsToSpecialist,
} from '../dist/a2a-v1/core/risk-core.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const recentMI = {
  id: 'recent-mi',
  finding: 'Recent NSTEMI 4 weeks ago at outside hospital',
  category: 'cardiac-event',
  riskImplication: 'ACC/AHA: defer elective non-cardiac surgery 60 days post-MI',
  guidelineRef: 'ACC/AHA 2014',
  sourceDocumentId: 'doc-1',
  sourceSnippet: 'NSTEMI 4 weeks ago',
  confidence: 0.95,
  severity: 'critical',
  displayState: 'detected',
  verifiedSnippet: true,
};

const apixabanHold = {
  id: 'apixaban-hold',
  finding: 'Apixaban discontinued 2 days ago',
  category: 'medication',
  riskImplication: 'Bleeding risk if surgery <72h post-dose',
  sourceDocumentId: 'doc-1',
  sourceSnippet: 'patient stopped apixaban 2 days ago',
  confidence: 0.92,
  severity: 'high',
  displayState: 'pending-confirmation',
  verifiedSnippet: true,
};

const lowMets = {
  id: 'low-mets',
  finding: 'Functional capacity below 4 METs',
  category: 'functional',
  riskImplication: 'ACC/AHA: pre-op stress test indicated',
  sourceDocumentId: 'doc-2',
  sourceSnippet: 'ambulates with walker, dyspneic at one block',
  confidence: 0.88,
  severity: 'moderate',
  displayState: 'detected',
  verifiedSnippet: true,
};

const baselineRcri = {
  highRiskSurgery: false,
  ischemicHeartDisease: false,
  heartFailureHistory: false,
  cerebrovascularDisease: false,
  diabetesOnInsulin: true,
  creatinineAbove2: false,
};

const baselineAriscat = {
  age: 68,
  spo2Preop: 96,
  respiratoryInfectionLastMonth: false,
  preopHemoglobin: 13,
  surgicalIncisionSite: 'peripheral',
  surgeryDurationHours: 2,
  emergencySurgery: false,
};

const baselineMetabolic = {
  hba1c: { value: 9.2, unit: '%', riskFlag: true },
  egfr: { value: 55, unit: 'mL/min/1.73m2', riskFlag: false },
  bmi: { value: 28, unit: 'kg/m2', riskFlag: false },
  creatinine: { value: 1.4, unit: 'mg/dL', riskFlag: false },
};

// ─── Cancellation score ──────────────────────────────────────────────────────

test('cancellation score: zero findings → score 0', () => {
  const r = computeCancellationScore({ findings: [], daysToSurgery: 7, surgeryType: 'hip-arthroplasty' });
  assert.equal(r.score, 0);
  assert.equal(r.daysToSurgeryMultiplier, 1.1);
});

test('cancellation score: critical + high + moderate findings, urgent timing', () => {
  const r = computeCancellationScore({
    findings: [recentMI, apixabanHold, lowMets],
    daysToSurgery: 3,
    surgeryType: 'hip-arthroplasty',
  });
  // 40 + 25 + 12 = 77, * 1.3 (≤3 days) = 100.1 → cap 100
  assert.ok(r.score >= 90 && r.score <= 100);
  assert.equal(r.severityCounts.critical, 1);
  assert.equal(r.severityCounts.high, 1);
  assert.equal(r.severityCounts.moderate, 1);
});

test('cancellation score: capped at 100', () => {
  const findings = Array.from({ length: 5 }, (_, i) => ({ ...recentMI, id: `c-${i}` }));
  const r = computeCancellationScore({ findings, daysToSurgery: 1, surgeryType: 'hip-arthroplasty' });
  assert.equal(r.score, 100);
});

// ─── Cost band ───────────────────────────────────────────────────────────────

test('cost band: zero findings, hip arthroplasty, 7 days out', () => {
  const r = computeCostBand({ findings: [], daysToSurgery: 7, surgeryType: 'hip-arthroplasty' });
  // base $1200 + OR rescheduling (2200*2.5*0.4 .. 3800*2.5*0.6) = 1200+2200..1200+5700
  // urgency mult = 1.1
  assert.ok(r.low > 1500 && r.low < 5000, `low=${r.low}`);
  assert.ok(r.high > 5000 && r.high < 12000, `high=${r.high}`);
  assert.ok(r.high > r.low);
});

test('cost band: 3 findings adds severity contribution', () => {
  const r = computeCostBand({
    findings: [recentMI, apixabanHold, lowMets],
    daysToSurgery: 6,
    surgeryType: 'hip-arthroplasty',
  });
  // critical + high + moderate severity costs included
  assert.ok(r.low > 5000, `low=${r.low}`);
  assert.ok(r.high > 12000, `high=${r.high}`);
});

test('cost band: cardiac-bypass higher than hip-arthroplasty', () => {
  const cabg = computeCostBand({ findings: [], daysToSurgery: 7, surgeryType: 'cardiac-bypass' });
  const hip = computeCostBand({ findings: [], daysToSurgery: 7, surgeryType: 'hip-arthroplasty' });
  assert.ok(cabg.high > hip.high);
});

// ─── Preventable issues ──────────────────────────────────────────────────────

test('derivePreventableIssues: skips low severity, maps owner correctly', () => {
  const issues = derivePreventableIssues([recentMI, apixabanHold, lowMets], 6);
  assert.equal(issues.length, 3);
  assert.equal(issues.find(i => i.sourceFindingId === 'recent-mi').owner, 'cardiology');
  assert.equal(issues.find(i => i.sourceFindingId === 'apixaban-hold').owner, 'anesthesia');
  assert.equal(issues.find(i => i.sourceFindingId === 'low-mets').owner, 'cardiology');
});

test('derivePreventableIssues: daysToFix scales with severity but is capped by daysToSurgery', () => {
  const issues = derivePreventableIssues([recentMI], 2);
  assert.equal(issues[0].daysToFix, 1); // critical wants 1, daysToSurgery-1=1 → min(1,1)=1
});

// ─── Findings application: cardiac ───────────────────────────────────────────

test('cardiac: NSTEMI finding overrides ischemicHeartDisease=false → true', () => {
  const r = applyFindingsToCardiac(baselineRcri, [recentMI]);
  assert.equal(r.adjustedInput.ischemicHeartDisease, true);
  assert.equal(r.overrides.length, 1);
  assert.equal(r.overrides[0].field, 'rcri.ischemicHeartDisease');
  assert.equal(r.overrides[0].resolution, 'note-wins');
  assert.ok(r.criticalAlerts.some(a => a.includes('Recent MI')));
});

test('cardiac: medication-status pending-confirmation surfaces alert without override', () => {
  const r = applyFindingsToCardiac(baselineRcri, [apixabanHold]);
  assert.equal(r.overrides.length, 0);
  assert.ok(r.criticalAlerts.some(a => /clinician confirmation/i.test(a)));
});

test('cardiac: low-METs finding emits stress-test alert', () => {
  const r = applyFindingsToCardiac(baselineRcri, [lowMets]);
  assert.ok(r.criticalAlerts.some(a => /stress test/i.test(a)));
});

test('cardiac: NSTEMI when IHD already true does NOT add an override', () => {
  const r = applyFindingsToCardiac({ ...baselineRcri, ischemicHeartDisease: true }, [recentMI]);
  assert.equal(r.overrides.length, 0);
  assert.equal(r.adjustedInput.ischemicHeartDisease, true);
  assert.ok(r.criticalAlerts.length > 0);
});

// ─── Findings application: pulmonary ─────────────────────────────────────────

test('pulmonary: low-METs finding adds advisory alert (no input change)', () => {
  const r = applyFindingsToPulmonary(baselineAriscat, [lowMets]);
  assert.deepEqual(r.adjustedInput, baselineAriscat);
  assert.ok(r.criticalAlerts.length > 0);
});

// ─── Findings application: metabolic ─────────────────────────────────────────

test('metabolic: ignores low-severity findings', () => {
  const lowSev = { ...lowMets, severity: 'low', category: 'metabolic' };
  const r = applyFindingsToMetabolic(baselineMetabolic, [lowSev]);
  assert.equal(r.criticalAlerts.length, 0);
});

// ─── Routing ─────────────────────────────────────────────────────────────────

test('routing: cardiac receives cardiac-event + medication + functional', () => {
  const all = [recentMI, apixabanHold, lowMets];
  const cardiac = routeFindingsToSpecialist(all, 'cardiac');
  assert.equal(cardiac.length, 3);
});

test('routing: pulmonary receives respiratory + functional only', () => {
  const all = [recentMI, apixabanHold, lowMets];
  const pulmonary = routeFindingsToSpecialist(all, 'pulmonary');
  assert.equal(pulmonary.length, 1);
  assert.equal(pulmonary[0].id, 'low-mets');
});

test('routing: metabolic receives metabolic + medication only', () => {
  const all = [recentMI, apixabanHold, lowMets];
  const metabolic = routeFindingsToSpecialist(all, 'metabolic');
  assert.equal(metabolic.length, 1);
  assert.equal(metabolic[0].id, 'apixaban-hold');
});
