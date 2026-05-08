# PreOp Intel

> Po-native infrastructure for perioperative risk intelligence — A2A v1 + MCP + FHIR write-back with SHARP provenance

PreOp Intel is the deterministic backend that Prompt Opinion (Po) BYO agents call when a clinician asks "is this patient ready for surgery?". The system reads structured FHIR data and free-text H&P / consult / discharge notes through an MCP tool server, scores cancellation risk against validated guidelines (RCRI, ARISCAT) inside an A2A v1 orchestrator, and writes `RiskAssessment` / `CarePlan` / `Goal` / `Flag` / `ServiceRequest` resources back to the chart with SHARP provenance extensions on every one.

## Built for

**Agents Assemble: The Healthcare AI Endgame Hackathon** (sponsored by Prompt Opinion / Darena Health)

## How Po drives the system

```
Clinician  →  Po BYO Agent (workspace-configured LLM)
                │
                ├── MCP server  (streamable-HTTP, /mcp)
                │     12 tools — FHIR readers, RCRI/ARISCAT calculators,
                │     SHARP-tagged write-back, get_clinical_documents
                │
                └── A2A v1 orchestrator  (POST /, JSON-RPC)
                      one skill: assess-preoperative-risk
                      returns deterministic risk artifact
                      (RCRI + ARISCAT + cancellation cost band + critical alerts)
```

Three Po BYO agents (`note-extractor`, `orchestrator`, `action-plan`) sit between the clinician and our backend. Their system prompts live in [`docs/po-agents/`](docs/po-agents/) — paste-in markdown so Po's workspace LLM (Gemini, Claude, OpenAI — your call) can reason over the same prompts that ship with our backend.

The Next.js frontend in this repo is a static visual artifact — patient banner, FHIR resource viewer, demo data. The live demo runs inside Po's UI. The frontend's `Start Assessment` button is **non-functional**; it was the standalone-LLM path the project carried before it became Po-native.

## Standards

| Standard | How we use it |
|----------|---------------|
| **FHIR R4** | Read `Patient`, `Condition`, `Observation`, `MedicationRequest`, `DocumentReference`, `Binary`. Write `RiskAssessment`, `CarePlan`, `Goal`, `Flag`, `ServiceRequest` back with SHARP extensions. |
| **MCP (Model Context Protocol)** | Po-compatible streamable-HTTP server on `/mcp`. 12 tools. Per-request FHIR creds via `x-fhir-server-url` / `x-fhir-access-token` / `x-patient-id` headers, propagated through `AsyncLocalStorage`. Document fetcher caps response size at `MCP_MAX_DOCUMENT_BYTES` (default 5MB) to avoid OOM on outside-hospital scanned-PDF attachments. |
| **A2A v1 (spec 0.3.0)** | `AgentCard` at `/.well-known/agent-card.json`, JSON-RPC `POST /` `message/send`. FHIR context flows in `message.metadata` under the extension URI declared in `capabilities.extensions`. `X-API-Key` auth, per-bucket rate limit, structured single-line JSON request log. |
| **SHARP Extension Specs** | `sharp-context-source`, `sharp-evidence-link`, `sharp-confidence` extensions on every FHIR write-back resource so downstream systems can trace any recommendation back to the verbatim note text that justified it. |
| **SMART on FHIR** | OAuth scope-restricted bearer tokens. The frontend stores tokens in `sessionStorage` only. The backend never persists PHI. |

## Stack

| Layer | Technology |
|-------|------------|
| A2A v1 server | Express + `@a2a-js/sdk` v0.3 (`DefaultRequestHandler`, `InMemoryTaskStore`, `agentCardHandler`, `jsonRpcHandler`). Pure-deterministic executor (no LLM calls) |
| MCP server | Express + `@modelcontextprotocol/sdk` v1.29 streamable-HTTP transport |
| Frontend (visual artifact) | Next.js 14 App Router, Tailwind CSS, shadcn/ui |
| LLM driver | Po BYO — whatever model the user has configured in their Po workspace |
| Standards | FHIR R4, MCP, A2A v1 (spec 0.3.0), SHARP, SMART on FHIR |
| Monorepo | Turborepo, npm workspaces |
| Deploy | Any HTTPS host that runs Node + Express (Fly, Render, Railway). Tunneling (ngrok / cloudflared) for hackathon demos |

## Features

- **Po-native protocol surface** — A2A v1 spec 0.3.0 + MCP streamable-HTTP. Po registers our agent card and our MCP URL once; the rest is just configuration.
- **Validated risk calculators** — RCRI (Lee 1999), ARISCAT (Canet 2010), with literature citations in code.
- **Defensive verifier** — when Po passes raw findings + source documents, the A2A executor drops any finding whose snippet isn't a verbatim substring of its cited document. Second line of defense behind Po's prompt-level rules.
- **Conflict resolution with safety carve-outs** — confidence-gated override + provenance trail for most conflicts; medication-status changes always require explicit clinician confirmation.
- **Cancellation risk model** — deterministic 0–100 score + auditable USD band (Macario 2010 OR-cost literature) + owner-tagged preventable-issues list.
- **FHIR write-back loop closure** — four R4 resources with SHARP provenance extensions on every one.
- **Production-y observability** — request log (single-line JSON, latency + status + key prefix), per-key rate limit (60 req/min/key by default).
- **HIPAA-conscious** — no PHI persisted anywhere in this codebase; source-of-truth stays in the FHIR server.

## Quick start

```bash
# Prerequisites: Node.js 20+, a Prompt Opinion workspace with a model key configured
git clone <repo-url>
cd preop-intel

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# At minimum set PO_AGENT_API_KEY_PRIMARY to a random secret

# Build everything
npm run build

# Start the two Po-facing servers + the visual frontend
npm run dev
# A2A v1 orchestrator (Po):  http://localhost:3003   (card at /.well-known/agent-card.json)
# MCP server (Po):           http://localhost:3002/mcp
# Frontend visual artifact:  http://localhost:3000
```

To wire Po: see [docs/SETUP.md](docs/SETUP.md) for the full registration steps. Short version: connect the MCP URL under Po → Tools, register the A2A agent card under Po → External Agents (paste `PO_AGENT_API_KEY_PRIMARY` as the API key), create three BYO agents and paste the prompts from `docs/po-agents/`.

## Pre-demo checklist

- ✓ `PO_AGENT_API_KEY_PRIMARY` set to a random secret in `.env`
- ✓ All 34 backend unit tests pass (`npm test`)
- ✓ Public HTTPS reachable for both `:3002/mcp` and `:3003/.well-known/agent-card.json` (ngrok / cloudflared / hosted)
- ✓ Po workspace has the MCP URL registered under Tools
- ✓ Po workspace has the A2A agent card registered under External Agents
- ✓ The three Po BYO agents have prompts from `docs/po-agents/` pasted in
- ✓ Live FHIR data exists for the demo patient (run `scripts/seed-meldrx-notes.mjs` against your MeldRx workspace)

## Project structure

```
preop-intel/
├── apps/
│   ├── frontend/              # Next.js 14 — visual artifact only (Start Assessment button is dead)
│   ├── backend/
│   │   └── src/a2a-v1/        # Po-compatible A2A v1 orchestrator
│   │       ├── server.ts        # Express entry on A2A_PORT (default 3003)
│   │       ├── app-factory.ts   # Wires DefaultRequestHandler + InMemoryTaskStore + executor
│   │       ├── agent-card.ts    # AgentCard at /.well-known/agent-card.json
│   │       ├── executor.ts      # PreOpRiskExecutor (no LLM calls — pure deterministic)
│   │       ├── middleware.ts    # X-API-Key auth
│   │       ├── observability.ts # Per-key rate limit + JSON request log
│   │       ├── fhir-context.ts  # Reads FHIR creds from message.metadata
│   │       └── core/risk-core.ts # RCRI, ARISCAT, findings application, cancellation, verifier
│   └── mcp-server/            # Po-compatible MCP server, streamable-HTTP on /mcp
│       └── src/
│           ├── builders/        # RiskAssessment, CarePlan builders w/ SHARP
│           ├── fhir/            # FHIR client + AsyncLocalStorage context
│           └── tools/           # 12 MCP tools (reads + calculators + writes + documents)
├── packages/
│   └── shared/                # TypeScript types + constants
├── docs/
│   ├── po-agents/             # Pasteable Po BYO agent prompts (note-extractor, orchestrator, action-plan)
│   ├── ARCHITECTURE.md        # Runtime topology, executor wire contract, standards
│   ├── SETUP.md               # Local dev + Po registration steps
│   ├── TESTING.md             # 34 unit tests
│   └── DEPLOY.md              # HTTPS deploy paths (tunnel / hosted)
└── .env.example               # Environment variable template
```

## Documentation

| Task | Canonical doc |
|------|---------------|
| Set up a local environment + Po registration | [docs/SETUP.md](docs/SETUP.md) |
| Understand topology / wire contracts / standards | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Run tests | [docs/TESTING.md](docs/TESTING.md) |
| Deploy public HTTPS for Po | [docs/DEPLOY.md](docs/DEPLOY.md) |
| Seed clinical notes to a live FHIR sandbox | `scripts/seed-meldrx-notes.mjs` |
| Review or change risk calculator logic | `apps/backend/src/a2a-v1/core/risk-core.ts` |
| Add a new MCP tool | `apps/mcp-server/src/tools/` |

## Security & compliance

- **No PHI persisted in this codebase.** Source-of-truth clinical data stays in the FHIR server. We hold zero chart bytes after a request finishes.
- **Defensive verifier** — A2A executor drops findings whose snippets aren't verbatim substrings of their cited documents (when the caller passes documents).
- **Medication-status carve-out** — auto-overriding a medication's `active ↔ discontinued` status without clinician confirmation could mask a real bleeding event. Findings flagged `pending-confirmation` regardless of confidence; clinician confirms before they flow into the assessment.
- **Provenance on every output** — SHARP extensions on FHIR write-back resources let any downstream EHR or agent trace recommendations back to the exact note text that justified them.
- **API key + rate limit on the public A2A surface.** Bypass for `/.well-known/agent-card.json` and `/health`.
- **SMART on FHIR** — OAuth 2.0 with scope-restricted bearer tokens.

## License

MIT
