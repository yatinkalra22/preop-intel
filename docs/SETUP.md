# Local Development Setup

## Prerequisites

- **Node.js** 20.x or later (24.x supported and tested)
- **npm** 10.x (uses npm workspaces)
- **Docker** + Docker Compose (for Postgres + Redis)
- **Anthropic API key** — required for the orchestrator and note extractor
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
| `ANTHROPIC_API_KEY` | backend, MCP server | Required even in demo mode (orchestrator, note extractor, action plan) |
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
| `ORCHESTRATOR_MODEL` | `claude-opus-4-7` |
| `NOTE_EXTRACTOR_MODEL` | `claude-sonnet-4-6` |
| `ACTION_PLAN_MODEL` | `claude-sonnet-4-6` |
| `A2A_MODE` | `local` (set to `live` to see real HTTP traffic between agents) |

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

Single command for all three apps:

```bash
npm run dev
```

Or run individually:

```bash
# Backend on :3001
cd apps/backend && npm run dev

# Frontend on :3000
cd apps/frontend && npm run dev

# MCP server on :3002
cd apps/mcp-server && npm run dev
```

## 6. Verify

```bash
# Backend health
curl http://localhost:3001/api/health

# MCP server health
curl http://localhost:3002/health
# Expect: {"status":"ok","server":"preop-intel-mcp","tools":12}

# A2A agent cards
curl http://localhost:3001/a2a/agents
# Expect: { "agents": [ ... 5 cards ... ] }

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
- **"ANTHROPIC_API_KEY missing"** — required even in demo mode for the orchestrator. Set in `.env` (or shell env if running individually).
- **Frontend shows blank assessment screen** — backend likely down. Check `curl http://localhost:3001/api/health`.
- **Tests find no compiled files** — incremental cache stale. `rm -f apps/backend/tsconfig.tsbuildinfo && npm run build` in the backend.
- **A2A traffic not showing in DevTools** — confirm `A2A_MODE=live` is set. Filter to `Fetch/XHR`. The traffic is between local services so the URLs all start with `http://localhost:3001/a2a/`.

See also: [TESTING.md](TESTING.md), [DEPLOY.md](DEPLOY.md).
