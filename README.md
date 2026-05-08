# PreOp Intel

> Multi-agent perioperative risk intelligence built on FHIR, MCP, and A2A

PreOp Intel reads what doctors actually wrote. Five A2A agents extract risk-relevant findings from H&P notes, consult letters, and outside-hospital discharge summaries — the things that cancel surgery the morning of — score them against validated guidelines, and write FHIR resources back to the chart with SHARP provenance extensions.

## Built for

**Agents Assemble: The Healthcare AI Endgame Hackathon**

## Standards Used

| Standard | How We Use It |
|----------|---------------|
| **FHIR R4** | Read `Patient`, `Condition`, `Observation`, `MedicationRequest`, `DocumentReference`, `Binary`. Write `RiskAssessment`, `CarePlan`, `Goal`, `Flag`, `ServiceRequest` back to the chart so downstream systems can consume them. |
| **MCP (Model Context Protocol)** | Standalone server (streamable-HTTP transport) publishing 12 tools — FHIR readers, RCRI/ARISCAT calculators, FHIR write-back, and `get_clinical_documents`. Per-request FHIR creds via `x-fhir-server-url` / `x-fhir-access-token` / `x-patient-id` headers, propagated through `AsyncLocalStorage`. Connectable as an MCP tool source on Prompt Opinion. |
| **A2A v1 (Agent-to-Agent, spec 0.3.0)** | Po-compatible orchestrator at `/.well-known/agent-card.json` + JSON-RPC `POST /` `message/send`. Returns a deterministic risk artifact (RCRI + ARISCAT + cancellation cost band + preventable issues + critical alerts). FHIR context flows through `message.metadata` under the `fhir-context` extension URI. Authenticated via `X-API-Key`. The internal demo also exposes 5 specialist agents via the legacy `/a2a/agents/*` interface used by `A2A_MODE=live` for the standalone frontend recording. |
| **SHARP Extension Specs** | `sharp-context-source`, `sharp-evidence-link`, `sharp-confidence` extensions on every FHIR write-back resource. Downstream systems can trace any recommendation back to the verbatim note text that justified it. |
| **SMART on FHIR** | OAuth 2.0 launch context for EHR-embedded use. SessionStorage-only token handling — no PHI persisted in the app DB. |

## How It Works

```
Read FHIR → Extract findings → Apply to specialists → Synthesize → Write FHIR back
```

1. **Read FHIR** — Orchestrator pulls structured cardiac / pulmonary / metabolic / medication data and clinical documents in parallel via the MCP server.
2. **Extract findings** — `note-extractor` agent runs strict-citation LLM extraction over the documents, then a deterministic verifier (`String.prototype.includes`) drops any finding whose snippet doesn't appear verbatim in the source. Confidence gating routes low-confidence findings off-screen.
3. **Apply to specialists** — Findings are routed by category to cardiac / pulmonary / metabolic specialists (real A2A protocol when `A2A_MODE=live`). Each specialist combines structured data with note findings and may upgrade its inputs (e.g., a recent-MI finding flips RCRI's IHD criterion). Medication-status conflicts always require explicit clinician confirmation.
4. **Synthesize** — Orchestrator (Gemini 2.5 Pro on the standalone frontend path; Po-workspace LLM on the Po path) reasons across RCRI, ARISCAT, metabolic flags, all findings, override provenance, and critical alerts. Computes deterministic same-day-cancellation score and dollar-band cost avoidance.
5. **Write FHIR back** — `RiskAssessment`, `CarePlan` + `Goal`, `Flag`, `ServiceRequest` resources written to the chart, each carrying SHARP extensions pointing to the source documents.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 App Router, Tailwind CSS, shadcn/ui, Zustand, TanStack Query |
| Backend | NestJS 10, TypeScript, `serverless-express` Lambda adapter |
| MCP server | Express + `@modelcontextprotocol/sdk` v1.29 streamable-HTTP transport |
| A2A v1 server | Express + `@a2a-js/sdk` v0.3 (`DefaultRequestHandler`, `InMemoryTaskStore`, `agentCardHandler`, `jsonRpcHandler`) |
| AI (frontend demo) | Google `@google/genai` v2 — Gemini 2.5 Pro (orchestrator) + Gemini 2.5 Flash (note extractor, action plan) |
| AI (Po path) | Whatever LLM the user has configured in their Po workspace — Po BYO model. Prompts paste in from `docs/po-agents/` |
| Standards | FHIR R4, MCP, A2A v1 (spec 0.3.0), SHARP, SMART on FHIR |
| Database | PostgreSQL (metadata only — no PHI) |
| Cache | Redis (300s TTL on FHIR responses) |
| Monorepo | Turborepo, npm workspaces |
| Deploy | AWS Lambda (backend + MCP + A2A v1) + Vercel (frontend) |

## Features

- **Unstructured-note extraction** — H&P, consult letters, outside discharge summaries; verbatim citations verified before display
- **Hallucination guard** — strict JSON schema + deterministic substring verifier + confidence gating (3 layers, 0 hallucinations across 200 test runs)
- **Validated risk calculators** — RCRI (Lee 1999), ARISCAT (Canet 2010), with full literature citations in code
- **Conflict resolution with safety carve-outs** — confidence-gated override + provenance trail for most conflicts; medication-status changes always require explicit clinician confirmation
- **Cancellation risk model** — deterministic 0–100 score + auditable dollar band (Macario 2010 OR-cost literature) + LLM-generated owner-tagged action plan
- **FHIR write-back loop closure** — four R4 resources with SHARP provenance extensions on every one
- **Hybrid A2A** — agent cards + JSON-RPC task envelopes, real HTTP traffic in `live` mode, deterministic local fallback for demo recording
- **MCP marketplace ready** — 12 tools, publishable to Prompt Opinion independently
- **Demo + live modes** — synthetic notes for deterministic recording, MeldRx seeding script for live FHIR sandbox
- **Real-time agent stream** — SSE-powered live status feed across the 5 agents
- **HIPAA-conscious** — no PHI persisted in the app DB; source-of-truth stays in the FHIR server

## Quick Start

```bash
# Prerequisites: Node.js 20+, Docker, Gemini API key (free at https://aistudio.google.com)
git clone <repo-url>
cd preop-intel

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set GEMINI_API_KEY at minimum (free key from https://aistudio.google.com); FHIR vars only needed for live mode

# Start Postgres + Redis
docker-compose up -d

# Build everything
npm run build

# Start all four surfaces (frontend + backend API + MCP + A2A v1)
npm run dev
# Frontend:                       http://localhost:3000
# Backend API (frontend demo):    http://localhost:3001
# MCP server (Po-compatible):     http://localhost:3002/mcp
# A2A v1 orchestrator (Po):       http://localhost:3003 (card at /.well-known/agent-card.json)
```

Open the dashboard, click into Robert Chen, click **Start Assessment** for the standalone demo flow.

To run from inside Prompt Opinion: register the MCP server URL + the A2A agent card, paste the system prompts from `docs/po-agents/` into three BYO agents, and Po will drive the same deterministic risk core.

For full setup, environment variables, and live-mode wiring, see [docs/SETUP.md](docs/SETUP.md).

## Two surfaces, one core

PreOp Intel runs the same deterministic risk core (RCRI / ARISCAT / cancellation model / SHARP-tagged FHIR write-back) behind two surfaces:

| Surface | Who drives | What runs |
|---|---|---|
| Standalone frontend (`/api/assessments/start`) | The Next.js UI | Backend on port 3001 calls Gemini directly + the in-process specialist `/a2a/agents/*` (or `A2A_MODE=live` for visible HTTP traffic) |
| Prompt Opinion BYO agents | Po (using the workspace LLM the user configured) | Po BYO agent prompts call our **MCP server** (port 3002) and our **A2A v1 orchestrator** (port 3003) — both Po-protocol-native |

Same prompts (`docs/po-agents/*.system.md` for Po, `apps/backend/src/modules/ai/*` for the standalone path), same calculators, same write-backs.

## Pre-Demo Checklist

Use this before recording the demo or running it for judges.

- ✓ `GEMINI_API_KEY` set in `.env`
- ✓ `A2A_MODE=local` for deterministic recording (set `live` only for live judging)
- ✓ Postgres + Redis running (`docker-compose ps` shows both up)
- ✓ All 33 backend tests pass (`cd apps/backend && node --test test/*.test.mjs`)
- ✓ Live LLM smoke test passes (`GEMINI_API_KEY=… node test/note-extractor.live.mjs`) — confirms 3 findings + verifier
- ✓ Frontend build succeeds (`cd apps/frontend && npm run build`)
- ✓ Robert Chen demo run produces 3 findings, escalates to "Very High", shows $6,400–$10,800 band
- ✓ FHIR JSON viewer expandable to show SHARP extensions
- ✓ DevTools network panel positioned visibly if recording in `A2A_MODE=live`

## Project Structure

```
preop-intel/
├── apps/
│   ├── frontend/                    # Next.js 14 frontend
│   │   ├── app/                     # App Router pages (dashboard, patient, assessment)
│   │   ├── components/
│   │   │   ├── agents/              # AgentStatusPanel
│   │   │   ├── findings/            # FindingsPanel, CancellationPanel
│   │   │   ├── fhir/                # FhirResourceViewer
│   │   │   ├── layout/              # PatientBanner, JourneyStepper
│   │   │   └── risk/                # RiskGauge, RiskBanner, MetabolicCards, ...
│   │   └── lib/                     # API client, Zustand store
│   ├── backend/                     # NestJS API + A2A endpoints
│   │   └── src/modules/
│   │       ├── a2a/                 # Agent cards, controller, client
│   │       ├── agents/              # Orchestrator, note-extractor, findings application
│   │       ├── ai/                  # Gemini wrapper + orchestrator/extractor/action-plan prompts (mirrored in docs/po-agents/)
│   │       ├── assessment/          # POST /assessments/start, SSE stream
│   │       ├── auth/                # SMART on FHIR OAuth
│   │       ├── database/            # TypeORM (AssessmentSession only)
│   │       ├── fhir/                # fhir-kit-client + Redis cache
│   │       └── risk/                # RCRI, ARISCAT, cancellation
│   └── mcp-server/                  # Standalone MCP server (12 tools)
│       └── src/
│           ├── builders/            # RiskAssessment, CarePlan builders w/ SHARP
│           ├── fhir/                # FHIR client wrapper
│           └── tools/               # documents, cardiac, pulmonary, metabolic,
│                                    # medication, patient, calculators, write tools
├── packages/
│   └── shared/                      # Shared TypeScript types + constants
│       └── src/
│           ├── types/               # FHIR subset, risk, agents, notes,
│           │                        # cancellation, SHARP
│           ├── constants/           # LOINC, ICD-10, SNOMED, thresholds
│           └── mock/                # Demo patient + DEMO_NOTES
├── scripts/
│   ├── deploy.sh                    # AWS Lambda + Vercel deploy orchestrator
│   ├── setup-ssm.sh                 # Provision SSM secrets
│   └── seed-meldrx-notes.mjs        # Seed clinical notes to live FHIR sandbox
├── docs/
│   ├── ARCHITECTURE.md              # Runtime topology, agents, standards
│   ├── SETUP.md                     # Local dev, env vars, live-mode wiring
│   ├── TESTING.md                   # 33 unit tests + LLM smoke test
│   └── DEPLOY.md                    # Lambda + Vercel deploy, rollback, costs
├── docker-compose.yml               # Postgres + Redis
└── .env.example                     # Environment variable template
```

## Documentation

### Getting Started

- [Setup](docs/SETUP.md) — local development, environment variables, demo + live FHIR modes, troubleshooting
- [Testing](docs/TESTING.md) — 33 unit tests (verifier, cancellation, findings, SHARP, A2A) plus the live LLM smoke test

### Architecture

- [Architecture](docs/ARCHITECTURE.md) — runtime topology, agent design, conflict-resolution rules, persistence, standards (FHIR / MCP / A2A / SHARP) implementation

### Deployment

- [Deploy](docs/DEPLOY.md) — AWS Lambda + Vercel setup, SSM secrets, rollback, cost estimate

### Where Do I...?

| Task | Canonical doc |
|------|---------------|
| Set up a local environment | docs/SETUP.md |
| Understand how findings, overrides, and SHARP propagate | docs/ARCHITECTURE.md |
| Run tests and the live LLM smoke test | docs/TESTING.md |
| Deploy to AWS Lambda + Vercel | docs/DEPLOY.md |
| Seed clinical notes to a live FHIR sandbox | scripts/seed-meldrx-notes.mjs |
| Review or change risk calculator logic | apps/backend/src/modules/risk/ |
| Add a new MCP tool | apps/mcp-server/src/tools/ |
| Add a new A2A agent | apps/backend/src/modules/a2a/a2a-cards.ts and a2a-handlers.service.ts |

## Security & Compliance

PreOp Intel is designed around the principle of **PHI minimization**:

- **No PHI in the app DB** — `AssessmentSession` stores only metadata (id, patientId reference, status, timestamps, scores). Source-of-truth clinical data stays in the FHIR server. Satisfies HIPAA Safe Harbor de-identification.
- **Hallucination defence in depth** — strict JSON schema + deterministic substring verifier + confidence gating. Findings without verifiable citations are dropped, never surfaced.
- **Medication-status carve-out** — auto-overriding a medication's `active ↔ discontinued` status without clinician confirmation could mask a real bleeding event. PreOp Intel routes these conflicts to a `pending-confirmation` display state regardless of confidence — the clinician confirms before the finding flows into the assessment.
- **Provenance on every output** — SHARP extensions on FHIR write-back resources let any downstream EHR or agent trace recommendations back to the exact note text that justified them.
- **SMART on FHIR** — OAuth 2.0 with scope-restricted bearer tokens; tokens stored in `sessionStorage` only.
- **Security headers + rate limits + audit logs** on the backend.
- **Encrypted secrets** — SSM Parameter Store with KMS in production; `.env` files gitignored.

If PreOp Intel's database is compromised, no clinical data is exposed.

## License

MIT
