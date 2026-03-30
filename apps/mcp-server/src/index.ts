// PreOp Intel MCP Server
// Exposes FHIR read/write tools via Model Context Protocol over SSE transport.
//
// Why standalone server (not embedded in NestJS)?
// - MCP server is a tool provider; NestJS is an orchestrator. Separate = publishable
//   to Prompt Opinion independently + separate Lambda scaling.
// - Source: https://modelcontextprotocol.io/docs/concepts/transports#sse
//
// Why SSE transport (not stdio)?
// - SSE works over HTTP — deployable to Lambda. stdio needs a persistent process.
// - Prompt Opinion's MCP client supports SSE natively.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';

import { registerPatientTool } from './tools/patient.tool.js';
import { registerCardiacTool } from './tools/cardiac.tool.js';
import { registerPulmonaryTool } from './tools/pulmonary.tool.js';
import { registerMetabolicTool } from './tools/metabolic.tool.js';
import { registerMedicationTool } from './tools/medication.tool.js';

const app = express();
app.use(express.json());

const server = new McpServer({
  name: 'preop-intel-mcp',
  version: '1.0.0',
});

// ─── Register all tools ──────────────────────────────────────────────────────
// Phase 3: Read tools (5)
registerPatientTool(server);
registerCardiacTool(server);
registerPulmonaryTool(server);
registerMetabolicTool(server);
registerMedicationTool(server);

// Phase 4: Calculator tools will be added here
// Phase 5: Write tools will be added here

// ─── SSE Transport ───────────────────────────────────────────────────────────
// Each SSE connection gets its own transport instance.
// The /mcp endpoint opens the SSE stream, /messages receives MCP requests.

let transport: SSEServerTransport;

app.get('/mcp', async (_req, res) => {
  transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  if (!transport) {
    res.status(400).json({ error: 'No active SSE connection' });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'preop-intel-mcp', tools: 5 });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.MCP_PORT ?? process.env.PORT ?? '3002');

app.listen(PORT, () => {
  console.log(`PreOp Intel MCP Server running on :${PORT}`);
  console.log(`  SSE endpoint: http://localhost:${PORT}/mcp`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
});
