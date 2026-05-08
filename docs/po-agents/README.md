# Prompt Opinion BYO agents for PreOp Intel

Po orchestrates LLM calls using the workspace model you've configured (Gemini, Claude, etc.). The agents below are the LLM-driven layer that sits *between* a clinician and our deterministic backend.

The flow Po runs at runtime:

```
Clinician  →  Po BYO Agent (uses workspace LLM + the prompts below)
                │
                ├─ MCP tools  → preop-intel MCP server  (read FHIR, calculators, write-back)
                │   docs.fetch / patient.read / cardiac.read / pulmonary.read /
                │   metabolic.read / medication.read / calc.rcri / calc.ariscat /
                │   write.riskAssessment / write.carePlan / write.flag / write.serviceRequest
                │
                └─ A2A agent  → preop-intel A2A v1 orchestrator
                    POST /  → message/send → returns deterministic risk artifact
```

## How to register these in Po

1. Sign in at https://app.promptopinion.ai
2. Configure a workspace model (Google AI Studio Gemini key — free tier is enough for the demo)
3. **Connect the MCP server** under *Tools*:
   - URL: your public `/mcp` endpoint (Po sends `x-fhir-server-url`, `x-fhir-access-token`, `x-patient-id` headers automatically)
4. **Register the A2A agent** under *External Agents*:
   - Agent-card URL: `https://<your-host>/.well-known/agent-card.json`
   - API key: the value of `PO_AGENT_API_KEY_PRIMARY` from your env
5. **Create three BYO agents** (Workspace → Agents → New) and paste the system prompts from this folder:
   - `note-extractor.system.md`
   - `orchestrator.system.md`
   - `action-plan.system.md`
6. For end-to-end demo: configure the **Note Extractor** agent first (it produces findings), then chain to **Orchestrator** (calls the A2A endpoint with findings + structured inputs), then **Action Plan** (reasons over the artifact).

## Why prompts live here, not in code

Po's whole pitch is workspace-configured LLMs. Keeping these prompts in repo as paste-able markdown makes them auditable in git history and decouples the LLM-runtime from our backend. Our backend only ships deterministic logic.

The same prompts are still wired into `apps/backend/src/modules/ai/*` for the standalone frontend demo (`/api/assessments/start`) — that path uses Gemini directly and bypasses Po. Two surfaces, one set of prompts.
