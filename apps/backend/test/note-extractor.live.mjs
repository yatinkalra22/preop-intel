// Live extractor smoke test — exercises the full LLM pipeline against
// the 3 hand-crafted Robert Chen demo notes.
//
// Requires: ANTHROPIC_API_KEY in env.
// Run with:  ANTHROPIC_API_KEY=sk-... node apps/backend/test/note-extractor.live.mjs
//
// Asserts:
//   - At least 3 findings extracted
//   - Every finding has verifiedSnippet === true
//   - Categories include medication, functional, cardiac-event (the 3 wedge findings)

import { NoteExtractorService } from '../dist/modules/agents/note-extractor.service.js';
import { DEMO_NOTES } from '@preop-intel/shared';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set in env');
  process.exit(1);
}

const service = new NoteExtractorService();

console.log(`\nRunning note-extractor against ${DEMO_NOTES.length} demo notes...`);
console.log(`Model: ${process.env.NOTE_EXTRACTOR_MODEL ?? 'claude-sonnet-4-6 (default)'}\n`);

const result = await service.extract({
  documents: DEMO_NOTES,
  patientContext: {
    age: 68,
    sex: 'male',
    plannedProcedure: 'Right total hip arthroplasty',
  },
});

console.log(`Documents in: ${result.documentCount}`);
console.log(`Findings out: ${result.findings.length}`);
console.log(`Rejected (verifier): ${result.rejectedCount}`);
console.log(`Duration: ${result.durationMs}ms\n`);

for (const f of result.findings) {
  console.log(`[${f.severity.toUpperCase()}] ${f.category}: ${f.finding}`);
  console.log(`  confidence: ${f.confidence.toFixed(2)} | display: ${f.displayState}`);
  console.log(`  source: ${f.sourceDocumentId}`);
  console.log(`  snippet: "${f.sourceSnippet}"`);
  if (f.guidelineRef) console.log(`  guideline: ${f.guidelineRef}`);
  console.log(`  rationale: ${f.riskImplication}\n`);
}

// Assertions
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };

if (result.findings.length < 3) fail(`Expected >=3 findings, got ${result.findings.length}`);

const allVerified = result.findings.every(f => f.verifiedSnippet === true);
if (!allVerified) fail('Some findings have verifiedSnippet !== true');

const categories = new Set(result.findings.map(f => f.category));
const expected = ['medication', 'functional', 'cardiac-event'];
const missing = expected.filter(c => !categories.has(c));
if (missing.length > 0) fail(`Missing wedge categories: ${missing.join(', ')}`);

console.log('PASS — all assertions met. Day 1 wedge is real.');
