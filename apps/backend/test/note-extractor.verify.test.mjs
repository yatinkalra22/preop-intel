// Deterministic verifier tests.
//
// Run with:  node --test apps/backend/test/note-extractor.verify.test.mjs
//
// Tests the pure verifyAndGateFindings function (extracted into core/risk-core).
// In the Po-driven world the LLM extraction itself runs inside Po's BYO
// note-extractor agent (prompt under docs/po-agents/); this verifier is the
// defensive substring check the A2A v1 executor runs when documents are
// passed alongside rawFindings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAndGateFindings } from '../dist/a2a-v1/core/risk-core.js';
import { DEMO_NOTES } from '@preop-intel/shared';

const realFinding = {
  id: 'apixaban-hold',
  finding: 'Apixaban discontinued 2 days ago',
  category: 'medication',
  riskImplication: 'Bleeding risk if surgery <72h post-dose',
  sourceDocumentId: 'doc-rc-hp-2026-05-04',
  sourceSnippet: 'patient stopped apixaban 2 days ago',
  confidence: 0.92,
  severity: 'high',
};

const plantedHallucination = {
  id: 'fake-warfarin',
  finding: 'Warfarin INR 5.4',
  category: 'medication',
  riskImplication: 'Severe bleeding risk',
  sourceDocumentId: 'doc-rc-hp-2026-05-04',
  sourceSnippet: 'INR 5.4 noted on warfarin',
  confidence: 0.95,
  severity: 'critical',
};

const bogusDocId = {
  id: 'bogus-doc',
  finding: 'Something',
  category: 'other',
  riskImplication: 'whatever',
  sourceDocumentId: 'doc-does-not-exist',
  sourceSnippet: 'some text',
  confidence: 0.9,
  severity: 'low',
};

const lowConfidence = {
  id: 'low-conf',
  finding: 'Maybe a thing',
  category: 'other',
  riskImplication: 'unclear',
  sourceDocumentId: 'doc-rc-hp-2026-05-04',
  sourceSnippet: 'patient stopped apixaban 2 days ago',
  confidence: 0.3,
  severity: 'low',
};

const possibleConfidence = {
  id: 'possible',
  finding: 'Functional limitation',
  category: 'functional',
  riskImplication: 'May affect peri-op',
  sourceDocumentId: 'doc-rc-card-2026-04-28',
  sourceSnippet: 'ambulates with walker, dyspneic at one block',
  confidence: 0.72,
  severity: 'moderate',
};

const medStatusFinding = {
  id: 'med-status',
  finding: 'Apixaban held per cardiology',
  category: 'medication',
  riskImplication: 'Anticoagulation status changed',
  sourceDocumentId: 'doc-rc-hp-2026-05-04',
  sourceSnippet: 'Apixaban 5 mg BID — HELD per cardiology since 2026-05-02',
  confidence: 0.95,
  severity: 'high',
};

test('verifier keeps a real finding with verbatim snippet', () => {
  const result = verifyAndGateFindings([realFinding], DEMO_NOTES);
  assert.equal(result.kept.length, 1);
  assert.equal(result.rejectedCount, 0);
  assert.equal(result.kept[0].verifiedSnippet, true);
});

test('verifier drops a planted hallucination (snippet not in document)', () => {
  const result = verifyAndGateFindings([plantedHallucination], DEMO_NOTES);
  assert.equal(result.kept.length, 0);
  assert.equal(result.rejectedCount, 1);
  assert.match(result.rejectionReasons[0], /snippet not found verbatim/);
});

test('verifier drops finding with unknown sourceDocumentId', () => {
  const result = verifyAndGateFindings([bogusDocId], DEMO_NOTES);
  assert.equal(result.kept.length, 0);
  assert.equal(result.rejectedCount, 1);
  assert.match(result.rejectionReasons[0], /unknown sourceDocumentId/);
});

test('verifier hides findings below 0.6 confidence', () => {
  const result = verifyAndGateFindings([lowConfidence], DEMO_NOTES);
  assert.equal(result.kept.length, 0);
  assert.equal(result.rejectedCount, 1);
});

test('verifier marks 0.6-0.85 confidence findings as "possible"', () => {
  const result = verifyAndGateFindings([possibleConfidence], DEMO_NOTES);
  assert.equal(result.kept.length, 1);
  assert.equal(result.kept[0].displayState, 'possible');
});

test('verifier marks medication-status changes as "pending-confirmation"', () => {
  const result = verifyAndGateFindings([medStatusFinding], DEMO_NOTES);
  assert.equal(result.kept.length, 1);
  assert.equal(result.kept[0].displayState, 'pending-confirmation');
});

test('category filter excludes findings outside requested categories', () => {
  const result = verifyAndGateFindings([realFinding, possibleConfidence], DEMO_NOTES, ['functional']);
  assert.equal(result.kept.length, 1);
  assert.equal(result.kept[0].id, 'possible');
});

test('mixed batch: real + hallucination + bogus-doc — only real survives', () => {
  const result = verifyAndGateFindings(
    [realFinding, plantedHallucination, bogusDocId],
    DEMO_NOTES,
  );
  assert.equal(result.kept.length, 1);
  assert.equal(result.rejectedCount, 2);
  assert.equal(result.kept[0].id, 'apixaban-hold');
});
