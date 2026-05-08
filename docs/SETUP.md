# Local development setup

PreOp Intel is the Po-native deterministic backend. To see the full demo flow you need a Prompt Opinion workspace; everything in this repo is the agent infrastructure Po calls.

## Prerequisites

- **Node.js** 20.x or later (24.x supported and tested)
- **npm** 10.x (uses npm workspaces)
- **Prompt Opinion workspace** at https://app.promptopinion.ai with a model key configured (Gemini, Claude, OpenAI — your call)
- **MeldRx workspace** _(optional)_ — only needed for live FHIR. Demo mode works against the seeded mock data in `packages/shared/src/mock`

## 1. Clone and install

```bash
git clone <repo-url>
cd preop-intel
npm install
```

`npm install` resolves the four workspaces (frontend, backend, mcp-server, shared).

## 2. Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env
```

> **Need help finding the values?** [CREDENTIALS.md](CREDENTIALS.md) walks through every variable in `.env.example` step-by-step — where to sign up for each service, where the keys live in the dashboard, what's free, and how to rotate if a secret leaks.

Required:

| Variable | Default | Notes |
|---|---|---|
| `PO_AGENT_API_KEY_PRIMARY` | _none_ | Random secret. Paste the same value into Po's "External Agents" registration form so Po can authenticate against `/`. |
| `A2A_PORT` | `3003` | Port for the Po-facing A2A v1 orchestrator. |
| `A2A_PUBLIC_URL` | `http://localhost:3003` | Used inside the published `AgentCard` so Po can reach back. Replace with the public HTTPS URL once you tunnel/host. |
| `MCP_PORT` | `3002` | Port for the Po-facing MCP server. |

Optional:

| Variable | Default | Notes |
|---|---|---|
| `PO_AGENT_API_KEY_SECONDARY` | _empty_ | Second key for rotation |
| `PO_AGENT_REQUIRE_API_KEY` | `true` | Only set `false` for local dev curl without Po |
| `FHIR_EXTENSION_URI` | `https://app.promptopinion.ai/schemas/a2a/v1/fhir-context` | Po sends FHIR creds in `message.metadata` under this URI |
| `A2A_RATE_LIMIT_PER_MIN` | `60` | Per-key + per-IP token bucket |
| `MCP_MAX_DOCUMENT_BYTES` | `5242880` (5MB) | Caps document text returned by `get_clinical_documents` |

## 3. Build everything

```bash
npm run build
```

Builds all workspaces in topological order (`packages/shared` first).

## 4. Run the apps

```bash
npm run dev
```

Or run individually:

```bash
# A2A v1 server (Po-compatible) on :3003
cd apps/backend && npm run dev

# MCP server (Po-compatible streamable-HTTP) on :3002
cd apps/mcp-server && npm run dev

# Frontend visual artifact on :3000 (Start Assessment button is non-functional — Po drives the demo)
cd apps/frontend && npm run dev
```

## 5. Verify locally

```bash
# A2A v1 — agent card (always public)
curl http://localhost:3003/.well-known/agent-card.json
# Expect: { "name": "preop_intel_orchestrator", "protocolVersion": "0.3.0", ... }

# A2A v1 — auth check (no key → 401, wrong key → 403)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3003/ \
  -H "content-type: application/json" -d '{}'

# A2A v1 — happy path (requires X-API-Key matching PO_AGENT_API_KEY_PRIMARY)
curl -s -X POST http://localhost:3003/ \
  -H "content-type: application/json" \
  -H "X-API-Key: $PO_AGENT_API_KEY_PRIMARY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"messageId":"m1","role":"user","kind":"message","parts":[{"kind":"data","data":{"plannedProcedure":"Total knee","daysToSurgery":14,"surgeryType":"orthopedic","rcri":{"highRiskSurgery":false,"ischemicHeartDisease":false,"heartFailureHistory":false,"cerebrovascularDisease":false,"diabetesOnInsulin":false,"creatinineAbove2":false},"ariscat":{"age":68,"spo2Preop":96,"respiratoryInfectionLastMonth":false,"preopHemoglobin":13,"surgicalIncisionSite":"peripheral","surgeryDurationHours":1.5,"emergencySurgery":false},"metabolic":{"hba1c":{"value":7.2,"unit":"%","riskFlag":false},"egfr":{"value":55,"unit":"mL/min","riskFlag":true},"bmi":{"value":31,"unit":"kg/m2","riskFlag":true},"creatinine":{"value":1.4,"unit":"mg/dL","riskFlag":false}},"findings":[]}}]}}}' | head -c 500

# MCP server health
curl http://localhost:3002/health
# Expect: {"status":"ok","server":"preop-intel-mcp","tools":12}

# MCP — initialize handshake
curl -s -X POST http://localhost:3002/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'
```

## 6. Wire it to Po

Po lives in the cloud and cannot reach `localhost`. You need an HTTPS URL for both `:3002` and `:3003` first — see [DEPLOY.md](DEPLOY.md) for tunnel + hosted options.

Once both endpoints are publicly reachable:

1. Sign in at https://app.promptopinion.ai.
2. Configure a workspace model (Google AI Studio Gemini key — free tier is enough for the demo).
3. **Connect the MCP server** under *Tools*:
   - URL: your public `/mcp` endpoint
   - Po will send the FHIR creds in `x-fhir-server-url`, `x-fhir-access-token`, `x-patient-id` headers automatically once you launch from a SMART context.
4. **Register the A2A agent** under *External Agents*:
   - Agent-card URL: `https://<your-host>/.well-known/agent-card.json`
   - API key: the value of `PO_AGENT_API_KEY_PRIMARY` from your env
5. **Create three BYO agents** (Workspace → Agents → New) and paste the system prompts from `docs/po-agents/`:
   - `note-extractor.system.md`
   - `orchestrator.system.md`
   - `action-plan.system.md`
6. From a clinician chat: ask the orchestrator to assess a patient. It will fan out to `note-extractor` (which calls `get_clinical_documents` via MCP), then call our A2A v1 agent, then hand the artifact to `action-plan`.

## Live FHIR (optional)

For the demo to read real chart data instead of demo notes, configure a MeldRx workspace and seed it:

```bash
node scripts/seed-meldrx-notes.mjs
```

The seed script is configured via env vars at the top of the script. Po sends the resulting FHIR creds (workspace base URL + access token + patient ID) in MCP request headers and A2A `message.metadata`; this repo never stores them.

## Troubleshooting

- `"No API keys configured"` from the A2A v1 server → set `PO_AGENT_API_KEY_PRIMARY` in `.env` and restart.
- Po says it can't reach the agent card → confirm `A2A_PUBLIC_URL` matches the URL Po actually fetches; the `AgentCard.url` field must point at the same origin.
- `429 Too many requests` on the A2A v1 server → bump `A2A_RATE_LIMIT_PER_MIN`. Default is 60/min/key.
- `documentCount: 0` in `get_clinical_documents` despite documents existing → check `MCP_MAX_DOCUMENT_BYTES`; oversized docs return as `skipped: 'oversize'`.
