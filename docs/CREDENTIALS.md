# Credentials Guide — every value in `.env.example`, where to get it

This walks through each variable in [`.env.example`](../.env.example) end-to-end. None of these costs money for a hackathon-scale demo. Plan ~15 minutes start to finish.

> **Heads up:** never commit your filled-in `.env` — it's gitignored. If you suspect a secret leaked, rotate it (every key here has a "rotate" path documented at the bottom).

## At a glance

| Variable | Required? | Where it comes from | Cost |
|---|---|---|---|
| `PO_AGENT_API_KEY_PRIMARY` | **yes** | You generate it (random secret) | $0 |
| `PO_AGENT_API_KEY_SECONDARY` | optional | You generate it (rotation slot) | $0 |
| `PO_AGENT_REQUIRE_API_KEY` | yes (default `true`) | Config — keep `true` in prod | — |
| `A2A_PORT` / `MCP_PORT` | yes (defaults work) | Config — `3003` and `3002` | — |
| `A2A_PUBLIC_URL` | **yes for Po** | Your public HTTPS URL (tunnel or hosted) | $0 |
| `FHIR_EXTENSION_URI` | yes (default works) | Po-defined constant — leave as-is unless Po announces a new URI | — |
| `A2A_RATE_LIMIT_PER_MIN` | optional | Config — defaults to 60 | — |
| `MCP_MAX_DOCUMENT_BYTES` | optional | Config — defaults to 5MB | — |

You will **also** need credentials inside Po itself (a model API key, the workspace registration of our MCP + A2A endpoints, three BYO agent prompts). Those don't go in `.env` — they live in your Po workspace. Steps 2–5 below cover them.

---

## 1. Generate `PO_AGENT_API_KEY_PRIMARY`

This is a random secret you make up. The A2A v1 server checks every request's `X-API-Key` header against this value. The same value goes into Po so Po can authenticate.

```bash
# Mac/Linux: 32-byte URL-safe random string
openssl rand -hex 32
# →  e.g.  9f3c2e5a8d1b4e7f...
```

Copy the output into `.env`:

```
PO_AGENT_API_KEY_PRIMARY=9f3c2e5a8d1b4e7f...
```

Optional: do the same for `PO_AGENT_API_KEY_SECONDARY` if you want a rotation slot.

> Why two keys? Rotate without downtime: set `_SECONDARY` to the new key, paste it into Po, then move it into `_PRIMARY` on the next deploy and clear `_SECONDARY`.

---

## 2. Sign up for a Prompt Opinion workspace (free)

1. Go to **https://app.promptopinion.ai** and sign up (Google / GitHub / email).
2. Create a workspace if prompted. Free tier is fine.

Nothing to copy back into `.env` — the workspace itself is hosted by Po.

---

## 3. Configure a model API key inside Po (free Gemini key)

Po doesn't ship its own LLM — it calls whatever model you've configured. The cheapest path is Google's free Gemini key.

1. Go to **https://aistudio.google.com/app/apikey** (sign in with a Google account).
2. Click **Create API key** → choose / create a Google Cloud project → copy the key.
3. In Po: **Workspace settings → Models → Add provider → Google AI Studio (Gemini)**.
4. Paste the Gemini key.
5. Set the default model (Gemini 2.5 Flash is plenty for this demo; 2.5 Pro for the orchestrator if you want stronger reasoning).

> Other options: Anthropic Claude key from https://console.anthropic.com/settings/keys, OpenAI key from https://platform.openai.com/api-keys. All work the same — paste into Po → Models → Add provider.

This key never enters `.env` — it lives only inside Po. Our backend never sees it.

---

## 4. Get a public HTTPS URL for the A2A v1 server (`A2A_PUBLIC_URL`)

Po runs in the cloud and **cannot reach `http://localhost`**. You need a public HTTPS URL. Two paths:

### 4a. Tunnel (fastest, hackathon-friendly)

```bash
# Cloudflare tunnel — no signup, anonymous URL
brew install cloudflared           # macOS; on Linux: see https://pkg.cloudflare.com/index.html
cloudflared tunnel --url http://localhost:3003
# → https://random-words-xyz.trycloudflare.com   ← copy this URL

# Repeat in a second terminal for the MCP server
cloudflared tunnel --url http://localhost:3002
# → https://other-words-abc.trycloudflare.com    ← copy this URL too (you'll paste it in step 5)
```

Set the A2A tunnel URL in `.env`:

```
A2A_PUBLIC_URL=https://random-words-xyz.trycloudflare.com
```

> Restart the A2A server after changing `A2A_PUBLIC_URL` — the URL is baked into the published `AgentCard.url` at startup so Po can call back.

Alternative tunnels: **ngrok** (`ngrok http 3003`, free signup at https://dashboard.ngrok.com/signup), **localtunnel** (`npx localtunnel --port 3003`).

### 4b. Hosted (longer-lived, post-hackathon)

Deploy each Express app to Fly / Render / Railway. See [DEPLOY.md](DEPLOY.md) for platform commands. Use the platform-assigned `https://<your-app>.fly.dev` (or equivalent) as `A2A_PUBLIC_URL`.

---

## 5. Register the two endpoints inside Po

Now hand Po the URLs from step 4 + the API key from step 1.

### 5a. MCP server (Tools)

1. In Po: **Workspace → Tools → Add → MCP server**.
2. **URL**: `https://<your-mcp-tunnel-url>/mcp` *(remember the trailing `/mcp` path)*.
3. Save. Po will hit `tools/list` to discover the 12 tools — you should see `get_patient_surgical_data`, `get_clinical_documents`, `create_risk_assessment`, etc.

> **FHIR creds for MCP:** Po sends the patient's FHIR server URL + access token + patient ID in `x-fhir-server-url` / `x-fhir-access-token` / `x-patient-id` request headers automatically once you launch from a SMART context. You don't store FHIR creds in `.env` — Po does.

### 5b. A2A v1 orchestrator (External Agents)

1. In Po: **Workspace → External Agents → Add**.
2. **Agent-card URL**: `https://<your-a2a-tunnel-url>/.well-known/agent-card.json`.
3. **API key**: paste the value of `PO_AGENT_API_KEY_PRIMARY` from step 1.
4. Save. Po will fetch the card and confirm the agent is `preop_intel_orchestrator` with skill `assess-preoperative-risk`.

---

## 6. Paste the three BYO agent prompts into Po

Po doesn't auto-discover what to ask the LLM — you create three workspace agents and paste in the system prompts that ship in this repo.

| Po agent name | Prompt file | Model recommendation |
|---|---|---|
| `preop-note-extractor` | [`docs/po-agents/note-extractor.system.md`](po-agents/note-extractor.system.md) | Gemini 2.5 Flash (fast, cheap, good at structured JSON) |
| `preop-risk-orchestrator` | [`docs/po-agents/orchestrator.system.md`](po-agents/orchestrator.system.md) | Gemini 2.5 Pro (or Claude Sonnet 4.6) — stronger reasoning |
| `preop-action-plan` | [`docs/po-agents/action-plan.system.md`](po-agents/action-plan.system.md) | Gemini 2.5 Flash |

For each agent:

1. **Workspace → Agents → New**.
2. Name it as above.
3. Paste the **System prompt** block from the corresponding `.md` file.
4. Connect tools/agents:
   - `preop-note-extractor` → connect the **MCP server** (so it can call `get_clinical_documents`).
   - `preop-risk-orchestrator` → connect the **MCP server** + the **External Agent** (`preop_intel_orchestrator`) + the **`preop-note-extractor`** agent.
   - `preop-action-plan` → no tools. Pure transformation.

That's the full Po setup. From a clinician chat: ask `preop-risk-orchestrator` to assess a patient, and it fans out automatically.

---

## 7. (Optional) MeldRx workspace for live FHIR data

If you want the demo to read from a real FHIR server instead of the seeded `DEMO_NOTES` mock, you need a MeldRx workspace.

1. Sign up at **https://app.meldrx.com** — free developer tier.
2. **New workspace** → choose the FHIR R4 starter.
3. Copy three values from the workspace settings:
   - `Workspace base URL` → e.g. `https://app.meldrx.com/api/fhir/<workspace-id>`
   - `Client ID`
   - `Client secret`
4. Run the seeder to load the demo patient (Robert Chen) and clinical notes:
   ```bash
   FHIR_BASE_URL=https://app.meldrx.com/api/fhir/<workspace-id> \
   FHIR_CLIENT_ID=<id> \
   FHIR_CLIENT_SECRET=<secret> \
   node scripts/seed-meldrx-notes.mjs
   ```
5. In Po: launch the orchestrator agent **from a SMART context** that points at this workspace. Po injects the FHIR creds into MCP request headers and A2A `message.metadata` — they never sit in our `.env`.

> Don't have a SMART launcher? Po's docs cover how to bind a workspace's FHIR creds to a chat session: https://docs.promptopinion.ai/

---

## Smoke test before the demo

```bash
# 1. The A2A agent card is reachable + advertises spec 0.3.0
curl -s "$A2A_PUBLIC_URL/.well-known/agent-card.json" | grep -E 'protocolVersion|name'
# Expect: "name":"preop_intel_orchestrator", "protocolVersion":"0.3.0"

# 2. Auth rejection works
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$A2A_PUBLIC_URL/" \
  -H "content-type: application/json" -d '{}'
# Expect: 401

# 3. Auth happy path
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$A2A_PUBLIC_URL/" \
  -H "content-type: application/json" \
  -H "X-API-Key: $PO_AGENT_API_KEY_PRIMARY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"messageId":"x","role":"user","kind":"message","parts":[{"kind":"text","text":"{}"}]}}}'
# Expect: 200 (will return an error inside the body about missing fields — that's fine, it means auth + JSON-RPC parsing work)

# 4. MCP server lists 12 tools
curl -s -X POST "$MCP_PUBLIC_URL/mcp" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | grep -o '"name":"[^"]*"' | wc -l
# Expect: 12
```

---

## Rotating a leaked secret

| Secret | How to rotate |
|---|---|
| `PO_AGENT_API_KEY_PRIMARY` | Generate a new value (`openssl rand -hex 32`). Set it as `PO_AGENT_API_KEY_SECONDARY` first, redeploy, update Po's "External Agents" form to the new value, then move it into `_PRIMARY` and clear `_SECONDARY` on the next deploy. Zero downtime. |
| Po model API key (Gemini / Claude / OpenAI) | Go to the provider's API key page → revoke the leaked key → create a new one → paste it into Po → Workspace settings → Models. |
| MeldRx client secret | MeldRx workspace settings → rotate. Re-run `seed-meldrx-notes.mjs` if you bound it to env vars. |

---

## Troubleshooting

- **Po says "Agent unreachable" when registering** → confirm `$A2A_PUBLIC_URL` actually responds: `curl -i "$A2A_PUBLIC_URL/.well-known/agent-card.json"` should return 200 with `Content-Type: application/json`. If you see 404, the agent card path is wrong; if connection refused, the tunnel/host isn't running.
- **Po says "Auth failed"** → make sure the value pasted into Po's "API key" field exactly matches `PO_AGENT_API_KEY_PRIMARY` (no leading/trailing whitespace).
- **Po says "MCP tools list empty"** → Po expects the `/mcp` path; the URL must end in `/mcp`. Test directly: `curl -X POST "$MCP_PUBLIC_URL/mcp" -H "accept: application/json, text/event-stream" -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'` should return 12 tool definitions.
- **"No FHIR context in message"** → the upstream Po BYO agent isn't injecting the FHIR-context extension URI into `message.metadata`. Confirm the orchestrator was launched from a SMART context, or test the endpoint with a hand-crafted `metadata` payload (see [SETUP.md](SETUP.md)).
- **Rate-limited (429) during testing** → bump `A2A_RATE_LIMIT_PER_MIN` in `.env`. Default is 60/min/key.
