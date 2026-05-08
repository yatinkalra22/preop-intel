// Unit tests for SHARP extension structure + A2A v1 agent card.
//
// Run with:  node --test apps/backend/test/sharp-and-a2a.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSharpExtensions,
  SHARP_EXTENSION,
} from '@preop-intel/shared';
import { buildOrchestratorAgentCard } from '../dist/a2a-v1/agent-card.js';
import {
  applyFindingsToCardiac,
} from '../dist/a2a-v1/core/risk-core.js';

// ─── SHARP extensions ────────────────────────────────────────────────────────

test('buildSharpExtensions: undefined context → empty array', () => {
  assert.deepEqual(buildSharpExtensions(undefined), []);
});

test('buildSharpExtensions: context-source emitted with valueString', () => {
  const exts = buildSharpExtensions({ sourceAgent: 'cardiac' });
  assert.equal(exts.length, 1);
  assert.equal(exts[0].url, SHARP_EXTENSION.CONTEXT_SOURCE);
  assert.equal(exts[0].valueString, 'cardiac');
});

test('buildSharpExtensions: evidence-link nests sub-extensions with documentReference + snippet', () => {
  const exts = buildSharpExtensions({
    sourceAgent: 'note-extractor',
    evidenceLinks: [{
      documentReference: 'doc-rc-hp-2026-05-04',
      snippet: 'patient stopped apixaban 2 days ago',
      findingId: 'apixaban-hold',
      category: 'medication',
      severity: 'high',
    }],
  });
  const evLink = exts.find(e => e.url === SHARP_EXTENSION.EVIDENCE_LINK);
  assert.ok(evLink);
  assert.ok(evLink.extension);
  assert.ok(evLink.extension.find(s => s.url === 'documentReference')?.valueReference);
  assert.equal(
    evLink.extension.find(s => s.url === 'documentReference').valueReference.reference,
    'DocumentReference/doc-rc-hp-2026-05-04',
  );
  assert.equal(
    evLink.extension.find(s => s.url === 'snippet').valueString,
    'patient stopped apixaban 2 days ago',
  );
  assert.equal(evLink.extension.find(s => s.url === 'findingId').valueString, 'apixaban-hold');
});

test('buildSharpExtensions: confidence emitted with valueDecimal, clamped 0..1', () => {
  const exts = buildSharpExtensions({ sourceAgent: 'orchestrator', confidence: 1.5 });
  const conf = exts.find(e => e.url === SHARP_EXTENSION.CONFIDENCE);
  assert.equal(conf.valueDecimal, 1);
});

test('buildSharpExtensions: snippet >300 chars is truncated', () => {
  const long = 'a'.repeat(500);
  const exts = buildSharpExtensions({
    sourceAgent: 'note-extractor',
    evidenceLinks: [{ documentReference: 'd', snippet: long }],
  });
  const evLink = exts.find(e => e.url === SHARP_EXTENSION.EVIDENCE_LINK);
  const snippet = evLink.extension.find(s => s.url === 'snippet').valueString;
  assert.equal(snippet.length, 300);
});

test('buildSharpExtensions: full context has 4 top-level extensions', () => {
  const exts = buildSharpExtensions({
    sourceAgent: 'orchestrator',
    evidenceLinks: [
      { documentReference: 'd1', snippet: 'x' },
      { documentReference: 'd2', snippet: 'y' },
    ],
    confidence: 0.85,
  });
  // 1 source + 2 evidence-links + 1 confidence = 4
  assert.equal(exts.length, 4);
});

// ─── A2A v1 agent card ───────────────────────────────────────────────────────
// Po reads the agent card at /.well-known/agent-card.json. These assertions
// catch regressions that would silently break Po registration: protocol
// version, extension URI, security scheme, skill id.

test('agent card: A2A v1 spec 0.3.0 with FHIR extension and X-API-Key security', () => {
  const card = buildOrchestratorAgentCard({
    url: 'https://preop.example.com',
    fhirExtensionUri: 'https://app.promptopinion.ai/schemas/a2a/v1/fhir-context',
    requireApiKey: true,
  });

  assert.equal(card.protocolVersion, '0.3.0');
  assert.equal(card.preferredTransport, 'JSONRPC');
  assert.equal(card.url, 'https://preop.example.com');

  const fhirExt = (card.capabilities?.extensions ?? []).find(
    e => e.uri === 'https://app.promptopinion.ai/schemas/a2a/v1/fhir-context',
  );
  assert.ok(fhirExt, 'FHIR-context extension must be declared in capabilities.extensions');

  assert.ok(card.securitySchemes?.apiKey, 'apiKey scheme required when requireApiKey=true');

  const skill = (card.skills ?? []).find(s => s.id === 'assess-preoperative-risk');
  assert.ok(skill, 'card must expose the assess-preoperative-risk skill');
});

test('agent card: requireApiKey=false emits no securitySchemes', () => {
  const card = buildOrchestratorAgentCard({
    url: 'http://localhost:3003',
    fhirExtensionUri: 'https://example.test/fhir-context',
    requireApiKey: false,
  });
  assert.ok(!card.securitySchemes || Object.keys(card.securitySchemes).length === 0);
});

// ─── Findings application — sanity smoke ─────────────────────────────────────

const recentMI = {
  id: 'recent-mi',
  finding: 'NSTEMI 4 weeks ago',
  category: 'cardiac-event',
  riskImplication: 'ACC/AHA: defer 60d',
  guidelineRef: 'ACC/AHA',
  sourceDocumentId: 'doc-1',
  sourceSnippet: 'NSTEMI 4 weeks ago',
  confidence: 0.95,
  severity: 'critical',
  displayState: 'detected',
  verifiedSnippet: true,
};

const baselineRcri = {
  highRiskSurgery: false,
  ischemicHeartDisease: false,
  heartFailureHistory: false,
  cerebrovascularDisease: false,
  diabetesOnInsulin: false,
  creatinineAbove2: false,
};

test('applyFindingsToCardiac: critical NSTEMI flips IHD criterion + emits override', () => {
  const out = applyFindingsToCardiac(baselineRcri, [recentMI]);
  assert.equal(out.adjustedInput.ischemicHeartDisease, true);
  assert.equal(out.overrides.length, 1);
  assert.equal(out.overrides[0].field, 'rcri.ischemicHeartDisease');
});
