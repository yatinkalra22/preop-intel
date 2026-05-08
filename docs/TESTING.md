# Testing

PreOp Intel uses Node's built-in `node:test` runner — no Jest, no Vitest, no extra dev deps. Tests live in `apps/backend/test/*.test.mjs` and exercise the deterministic, pure-function surface of the system. The LLM-bound code path lives entirely inside Po (BYO agents drive the prompts in `docs/po-agents/`); we don't ship those calls in this repo, so there's nothing here that needs an API key.

## Test inventory (34 unit tests)

| Suite | File | Tests |
|---|---|---|
| Verifier | `apps/backend/test/note-extractor.verify.test.mjs` | 8 |
| Cancellation + findings | `apps/backend/test/cancellation-and-findings.test.mjs` | 17 |
| SHARP + A2A v1 agent card | `apps/backend/test/sharp-and-a2a.test.mjs` | 9 |

Each suite is independently runnable and produces TAP-style output.

## Run all tests

```bash
npm test
```

This builds the backend (`tsc`) and runs all suites. Expected output ends with:

```
ℹ tests 34
ℹ pass 34
ℹ fail 0
```

If you see "Cannot find module '...dist/...'", the incremental TypeScript cache is stale. Clear and rebuild:

```bash
cd apps/backend && rm -f tsconfig.tsbuildinfo && rm -rf dist && npx tsc
```

## What's covered

### Verifier (`note-extractor.verify.test.mjs`)

The verifier is the defensive substring check the A2A v1 executor runs when the upstream Po agent passes raw findings + source documents. Tests assert:

- Real findings with verbatim snippets are kept
- Planted hallucinations (snippet not in source) are dropped
- Findings citing unknown `sourceDocumentId` are dropped
- Confidence `< 0.6` → hidden
- Confidence `0.6–0.85` → marked `displayState='possible'`
- Medication-status findings → `displayState='pending-confirmation'` regardless of confidence
- Category filter works
- Mixed batch: real + hallucination + bogus-doc — only real survives

### Cancellation + findings (`cancellation-and-findings.test.mjs`)

Cancellation:
- Score is 0 with no findings
- Score combines severity weights × urgency multiplier
- Score caps at 100
- Cost band scales with surgery type (cardiac-bypass > hip-arthroplasty)
- Cost band increases with severity-driven contributions
- Preventable issues skip low severity, map owner correctly, cap `daysToFix` at `daysToSurgery - 1`

Findings application:
- Cardiac: NSTEMI finding overrides `ischemicHeartDisease=false → true` and emits "defer surgery 60d" alert
- Cardiac: medication-status finding surfaces alert without overriding inputs
- Cardiac: low-METs finding triggers ACC/AHA stress-test alert
- Cardiac: NSTEMI when IHD already true does not duplicate the override
- Pulmonary: low-METs adds advisory alert without changing ARISCAT inputs
- Metabolic: low-severity findings ignored

Routing:
- cardiac receives cardiac-event + medication + functional
- pulmonary receives respiratory + functional
- metabolic receives metabolic + medication

### SHARP + A2A v1 (`sharp-and-a2a.test.mjs`)

SHARP extension structure:
- `buildSharpExtensions(undefined)` → empty array
- Context-source emitted with `valueString`
- Evidence-link nests `documentReference`/`snippet`/optional sub-extensions
- Confidence emitted with `valueDecimal`, clamped to `[0, 1]`
- Snippets longer than 300 chars truncated
- Full context emits 4 top-level extensions (source + 2 evidence-links + confidence)

A2A v1 agent card (regression catches that would silently break Po registration):
- `protocolVersion: '0.3.0'`
- `preferredTransport: 'JSONRPC'`
- FHIR-context extension declared in `capabilities.extensions`
- `securitySchemes.apiKey` present when `requireApiKey: true`
- Skill `assess-preoperative-risk` exposed
- `requireApiKey: false` emits no `securitySchemes`

Findings application smoke:
- NSTEMI finding flips RCRI's IHD criterion via the executor's pure core

## Running a single suite

```bash
cd apps/backend
node --test test/note-extractor.verify.test.mjs
node --test test/cancellation-and-findings.test.mjs
node --test test/sharp-and-a2a.test.mjs
```

## Adding a test

1. Create `apps/backend/test/<feature>.test.mjs`
2. Import from `../dist/a2a-v1/...` (compiled output) — pure functions only
3. Use `import { test } from 'node:test'` and `import assert from 'node:assert/strict'`
4. Make sure the function under test is exported from `core/risk-core.ts` (or whichever module it lives in)

For fixtures, prefer reusing `DEMO_NOTES` from `@preop-intel/shared` rather than inlining.

## What's intentionally not tested in this repo

The LLM-driven extraction / synthesis / action-plan paths run inside Po — see `docs/po-agents/*.system.md`. Their non-determinism is exercised end-to-end during demo rehearsal in Po's UI, not here.

Frontend is not unit-tested. It's a visual artifact only; validate it via `npm run build` (production build must succeed) and a manual run-through (`cd apps/frontend && npm run dev`).
