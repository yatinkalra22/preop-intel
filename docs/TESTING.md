# Testing

PreOp Intel uses Node's built-in `node:test` runner — no Jest, no Vitest, no extra dev deps. Tests live in `apps/backend/test/*.test.mjs` and exercise the deterministic, pure-function surface of the system. The LLM-bound code path is exercised by a separate runnable smoke test that requires an Anthropic API key.

## Test inventory (33 unit tests)

| Suite | File | Tests |
|---|---|---|
| Verifier | `apps/backend/test/note-extractor.verify.test.mjs` | 8 |
| Cancellation + findings | `apps/backend/test/cancellation-and-findings.test.mjs` | 17 |
| SHARP + A2A | `apps/backend/test/sharp-and-a2a.test.mjs` | 8 |

Each suite is independently runnable and produces TAP-style output.

## Run all tests

```bash
cd apps/backend
npm run build              # Compile TypeScript first; tests import from dist/
node --test test/*.test.mjs
```

Expected output ends with:

```
ℹ tests 33
ℹ pass 33
ℹ fail 0
```

If you see "Cannot find module '...dist/...'", the incremental TypeScript cache is stale. Clear and rebuild:

```bash
rm -f tsconfig.tsbuildinfo && rm -rf dist && npm run build
```

## What's covered

### Verifier (`note-extractor.verify.test.mjs`)

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

### SHARP + A2A (`sharp-and-a2a.test.mjs`)

- `buildSharpExtensions(undefined)` → empty array
- Context-source emitted with `valueString`
- Evidence-link nests `documentReference`/`snippet`/optional sub-extensions
- Confidence emitted with `valueDecimal`, clamped to `[0, 1]`
- Snippets longer than 300 chars truncated
- Full context emits 3 top-level extensions (source + evidence-link + confidence)
- All 5 agent cards present and endpoint URLs match `/{name}/tasks`
- A2A handler equivalence: handler output equals in-process function output

## Live LLM smoke test (requires API key)

Exercises the full extraction pipeline against `DEMO_NOTES`:

```bash
cd apps/backend
ANTHROPIC_API_KEY=sk-... node test/note-extractor.live.mjs
```

Asserts:

- ≥3 findings extracted
- All findings have `verifiedSnippet === true`
- Categories include `medication`, `functional`, and `cardiac-event` (the 3 wedge findings)

Cost: ~$0.01 per run on `claude-sonnet-4-6`.

## Running a single suite

```bash
node --test test/note-extractor.verify.test.mjs
node --test test/cancellation-and-findings.test.mjs
node --test test/sharp-and-a2a.test.mjs
```

## Adding a test

1. Create `apps/backend/test/<feature>.test.mjs`
2. Import from `../dist/...` (compiled output) — pure functions only
3. Use `import { test } from 'node:test'` and `import assert from 'node:assert/strict'`
4. Make sure the function under test has been exported from the source module so the test can reach it

For tests that need fixtures, prefer reusing `DEMO_NOTES` from `@preop-intel/shared` rather than inlining.

## What's intentionally not tested

Per [the design](ARCHITECTURE.md), the LLM-bound code paths (`AiService.synthesizeRiskAssessment`, `CancellationService.generateActionPlan`) are not unit-tested — their outputs are non-deterministic. They're validated end-to-end via the live smoke test and during demo rehearsal. The verifier and confidence gating that *protect* those LLM outputs are exhaustively tested.

Frontend is also not unit-tested. UI is validated via manual run-through (`npm run dev` in `apps/frontend`) and the production build (`npm run build` must succeed).
