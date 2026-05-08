# Local Development Setup

## Prerequisites

- **Node.js** 20.x or later (24.x supported and tested)
- **npm** 10.x (uses npm workspaces)
- **Docker** + Docker Compose (for Postgres + Redis)
- **Gemini API key** — required for the standalone-frontend demo path (orchestrator, note extractor, action plan). Free key from https://aistudio.google.com
- **Prompt Opinion workspace** _(optional)_ — only needed if you want to drive the system from Po BYO agents. Po uses your own model key (Gemini, Claude, OpenAI) configured inside Po
- **MeldRx workspace** _(optional)_ — only needed if you want to run live FHIR mode rather than the deterministic demo path

## 1. Clone and install

```bash
git clone <repo-url>
cd preop-intel
npm install
```

`npm install` resolves the entire workspace (frontend, backend, MCP server, shared package).

## 2. Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env
```

Required for any local run:

| Variable | Where used | Notes |
|---|---|---|
| `GEMINI_API_KEY` | backend, MCP server | Required even in demo mode (orchestrator, note extractor, action plan). Free key from https://aistudio.google.com |
| `DATABASE_URL` | backend | Default points at the docker-compose Postgres |
| `REDIS_URL` | backend | Default points at the docker-compose Redis |
| `FRONTEND_URL` | backend | CORS allowlist; default `http://localhost:3000` |

Required for live FHIR mode (otherwise leave blank and run with demo mode):

| Variable | Notes |
|---|---|
| `FHIR_BASE_URL` | e.g. `https://app.meldrx.com/api/fhir/<workspace>` |
| `FHIR_CLIENT_ID` / `FHIR_CLIENT_SECRET` | from your MeldRx workspace |
| `SMART_CALLBACK_URL` | default `http://localhost:3001/api/auth/callback` |

Optional model overrides (sensible defaults already set):

| Variable | Default |
|---|---|
| `ORCHESTRATOR_MODEL` | `gemini-2.5-pro` |
| `NOTE_EXTRACTOR_MODEL` | `gemini-2.5-flash` |
| `ACTION_PLAN_MODEL` | `gemini-2.5-flash` |
| `A2A_MODE` | `local` (set to `live` to see real HTTP traffic between agents) |

Required for the Po-driven path (skip if only running the standalone frontend demo):

| Variable | Default | Notes |
|---|---|---|
| `A2A_PORT` | `3003` | Po-compatible A2A v1 orchestrator server |
| `A2A_PUBLIC_URL` | `http://localhost:3003` | Used inside the published `AgentCard` so Po can reach back |
| `PO_AGENT_API_KEY_PRIMARY` | _required_ | Random secret. Paste the same value into Po's "External Agents" form |
| `PO_AGENT_API_KEY_SECONDARY` | _empty_ | Optional second key for rotation |
| `PO_AGENT_REQUIRE_API_KEY` | `true` | Only set `false` for local dev curl smoke without Po |
| `FHIR_EXTENSION_URI` | `https://app.promptopinion.ai/schemas/a2a/v1/fhir-context` | Po sends FHIR creds in `message.metadata` under this URI |

## 3. Start dependencies

```bash
docker-compose up -d
```

Brings up Postgres on `:5432` and Redis on `:6379`. First-time start creates the database and runs initial schema.

## 4. Build everything

```bash
npm run build
```

Builds all workspaces in topological order (`packages/shared` first). If the build "succeeds" but produces no output, clear the incremental cache:

```bash
rm -f apps/backend/tsconfig.tsbuildinfo
rm -rf apps/backend/dist
npm run build
```

## 5. Run the apps

Single command for all four surfaces:

```bash
npm run dev
```

Or run individually:

```bash
# NestJS backend (frontend demo path) on :3001
cd apps/backend && npm run dev

# A2A v1 server (Po-compatible) on :3003
cd apps/backend && npm run dev:a2a

# Frontend on :3000
cd apps/frontend && npm run dev

# MCP server (Po-compatible streamable-HTTP) on :3002
cd apps/mcp-server && npm run dev
```

## 6. Verify

```bash
# Backend health (frontend demo)
curl http://localhost:3001/api/health

# MCP server health
curl http://localhost:3002/health
# Expect: {"status":"ok","server":"preop-intel-mcp","tools":12}

# Internal A2A agent cards (legacy demo surface)
curl http://localhost:3001/a2a/agents
# Expect: { "agents": [ ... 5 cards ... ] }

# A2A v1 (Po-compatible) agent card
curl http://localhost:3003/.well-known/agent-card.json
# Expect: { "name": "preop_intel_orchestrator", "protocolVersion": "0.3.0", ... }

# A2A v1 message/send (requires X-API-Key matching PO_AGENT_API_KEY_PRIMARY)
curl -s -X POST http://localhost:3003/ \
  -H "content-type: application/json" \
  -H "X-API-Key: $PO_AGENT_API_KEY_PRIMARY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"messageId":"m1","role":"user","kind":"message","parts":[{"kind":"data","data":{"plannedProcedure":"Total knee","daysToSurgery":14,"surgeryType":"orthopedic","rcri":{"highRiskSurgery":false,"ischemicHeartDisease":false,"heartFailureHistory":false,"cerebrovascularDisease":false,"diabetesOnInsulin":false,"creatinineAbove2":false},"ariscat":{"age":68,"spo2Preop":96,"respiratoryInfectionLastMonth":false,"preopHemoglobin":13,"surgicalIncisionSite":"peripheral","surgeryDurationHours":1.5,"emergencySurgery":false},"metabolic":{"hba1c":{"value":7.2,"unit":"%","riskFlag":false},"egfr":{"value":55,"unit":"mL/min","riskFlag":true},"bmi":{"value":31,"unit":"kg/m2","riskFlag":true},"creatinine":{"value":1.4,"unit":"mg/dL","riskFlag":false}},"findings":[]}}]}}}' | head -c 400

# Open the UI
open http://localhost:3000
```

The app boots in **demo mode** by default — click into Robert Chen and click **Start Assessment** to see the full flow without needing FHIR credentials.

## 7. Live FHIR mode (optional)

If you want the assessment to read from a real FHIR server:

1. Configure MeldRx variables in `.env` (see step 2)
2. Set `NEXT_PUBLIC_DEMO_MODE=false` in `.env`
3. Seed the demo patient on MeldRx with clinical notes:
   ```bash
   FHIR_BASE_URL=https://app.meldrx.com/api/fhir/<workspace> \
   FHIR_ACCESS_TOKEN=<bearer> \
   node scripts/seed-meldrx-notes.mjs
   ```
4. Restart the frontend (`Ctrl-C`, `npm run dev`)

## 8. Live A2A mode (optional)

To see real HTTP traffic between the orchestrator and specialists in your browser's DevTools network panel:

```bash
A2A_MODE=live npm run dev
```

Output is byte-identical between `local` and `live` modes — the difference is only whether specialists are invoked over HTTP.

## Troubleshooting

- **"Database connection refused"** — Postgres isn't running. `docker-compose up -d` and check `docker ps`.
- **"GEMINI_API_KEY missing"** — required even in demo mode for the orchestrator. Set in `.env` (or shell env if running individually). Free key at https://aistudio.google.com.
- **Frontend shows blank assessment screen** — backend likely down. Check `curl http://localhost:3001/api/health`.
- **Tests find no compiled files** — incremental cache stale. `rm -f apps/backend/tsconfig.tsbuildinfo && npm run build` in the backend.
- **A2A traffic not showing in DevTools** — confirm `A2A_MODE=live` is set. Filter to `Fetch/XHR`. The traffic is between local services so the URLs all start with `http://localhost:3001/a2a/`.

See also: [TESTING.md](TESTING.md), [DEPLOY.md](DEPLOY.md).
