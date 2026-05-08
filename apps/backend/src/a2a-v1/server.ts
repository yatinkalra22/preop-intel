// PreOp Intel — A2A v1 Orchestrator server entry.
//
// This is the public, Po-compliant agent surface. Register the agent-card URL
// inside your Po workspace's "External agents" page; Po will then call
// POST / for every message/send.
//
// Endpoints:
//   GET  /.well-known/agent-card.json   public, advertises X-API-Key + FHIR ext
//   POST /                              JSON-RPC 2.0; method = "message/send"
//   GET  /health                        liveness probe
//
// Env:
//   A2A_PORT                       port to bind (default 3003)
//   A2A_PUBLIC_URL                 public URL advertised in the agent card
//   FHIR_EXTENSION_URI             metadata key Po uses for FHIR context
//                                    (default https://app.promptopinion.ai/schemas/a2a/v1/fhir-context)
//   PO_AGENT_API_KEY_PRIMARY       valid X-API-Key; required to accept messages
//   PO_AGENT_API_KEY_SECONDARY     optional second key for rotation
//   PO_AGENT_REQUIRE_API_KEY=false disable auth (only for local dev)

import 'dotenv/config';
import { createA2aApp } from './app-factory';

const PORT = Number(process.env.A2A_PORT ?? 3003);
const PUBLIC_URL = process.env.A2A_PUBLIC_URL ?? `http://localhost:${PORT}`;
const FHIR_EXTENSION_URI = process.env.FHIR_EXTENSION_URI
  ?? 'https://app.promptopinion.ai/schemas/a2a/v1/fhir-context';
const REQUIRE_API_KEY = process.env.PO_AGENT_REQUIRE_API_KEY !== 'false';

const app = createA2aApp({
  url: PUBLIC_URL,
  fhirExtensionUri: FHIR_EXTENSION_URI,
  requireApiKey: REQUIRE_API_KEY,
});

app.listen(PORT, () => {
  console.info(`preop-intel A2A orchestrator listening on :${PORT}`);
  console.info(`  Agent card: GET  ${PUBLIC_URL}/.well-known/agent-card.json`);
  console.info(`  A2A RPC:    POST ${PUBLIC_URL}/  (X-API-Key ${REQUIRE_API_KEY ? 'required' : 'disabled'})`);
});
