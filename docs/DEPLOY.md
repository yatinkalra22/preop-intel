# Deploy

PreOp Intel ships two long-lived HTTPS services Po needs to reach: an A2A v1 orchestrator and an MCP server. Both are stateless Node + Express apps that fit any platform that runs Node — pick whatever your team is comfortable with.

For hackathon judging, **the only hard requirement is that Po can fetch the agent card and POST to the JSON-RPC endpoint over HTTPS.** Localhost won't work — Po runs in the cloud.

## Option A — Tunnel (fastest, hackathon-friendly)

Best when you want judges to drive Po against your local laptop.

```bash
# Terminal 1: run both servers locally
npm run dev

# Terminal 2: expose them via cloudflared (or ngrok / localtunnel)
cloudflared tunnel --url http://localhost:3003 &  # → https://<random>.trycloudflare.com  (A2A v1)
cloudflared tunnel --url http://localhost:3002 &  # → https://<random>.trycloudflare.com  (MCP)
```

Then update `.env`:

```
A2A_PUBLIC_URL=https://<a2a-tunnel-url>
```

…restart the A2A server (so the AgentCard.url advertises the public URL), and paste the URLs into Po's Tools + External Agents forms.

Tradeoff: tunnels die when your laptop sleeps. Re-run before the demo.

## Option B — Hosted (longer-lived, post-hackathon)

Both services run cleanly on:

- **Fly.io** — `fly launch` from each app dir, set env via `fly secrets set`. Free tier covers low traffic.
- **Render** — connect the repo, two services (one per `apps/*`), set start commands `npm start`.
- **Railway** — same idea, slightly more polished UI.
- **Vercel** — works for the frontend + can host the MCP/A2A servers as Edge functions if you wrap them in a Vercel handler. Not necessary for the hackathon.

Whatever platform you pick, you need:

- HTTPS termination
- Node 20+
- Two services (one per port — A2A on 3003, MCP on 3002 by default; the platform usually maps to its own ingress port)
- Environment variables from `.env.example`

## Required env in production

| Variable | Why |
|---|---|
| `PO_AGENT_API_KEY_PRIMARY` | Required. Random secret. Same value goes into Po. |
| `A2A_PUBLIC_URL` | Required. Public HTTPS URL — must match the URL Po fetches the card from. The A2A server advertises this in `AgentCard.url`. |
| `PO_AGENT_REQUIRE_API_KEY=true` | Required in prod. The default. |
| `PO_AGENT_API_KEY_SECONDARY` | Optional. Useful for zero-downtime key rotation. |
| `A2A_RATE_LIMIT_PER_MIN` | Optional. Tune per traffic. |
| `MCP_MAX_DOCUMENT_BYTES` | Optional. Lower for tight memory budgets. |

## Cost (rough)

For a hackathon-scale demo (~50 assessments / day):

| Resource | Estimated monthly |
|---|---|
| Fly.io shared-cpu-1x (1 service × 2) | $0 (free tier) |
| Cloudflare tunnel | $0 |
| Vercel Hobby (frontend visual artifact) | $0 |
| Po workspace (free Google AI Studio key) | $0 |
| **Total** | **$0** |

Po BYO model costs land on the user's Po-configured key, not on us.

## Rollback

For tunnel-based deploys: kill the tunnel, fix locally, restart.

For hosted deploys: most platforms keep the previous image around — re-deploy the previous git SHA, or platform-specific rollback (`fly releases rollback`, `render service rollback`, etc.).

## Smoke checks after deploy

```bash
# Public agent card must respond, no auth
curl https://your-public-host/.well-known/agent-card.json | head -c 500

# MCP /health
curl https://your-public-mcp-host/health

# Auth rejection sanity
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://your-public-host/ \
  -H "content-type: application/json" -d '{}'
# Expect 401
```
