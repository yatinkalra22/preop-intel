// PreOp Intel MCP Server
// Exposes FHIR read/write tools via Model Context Protocol.
//
// Transport: streamable-HTTP (per Po's contract — headers carry FHIR context).
// Endpoint:  POST /mcp
//
// Per-request FHIR context (set by Po):
//   x-fhir-server-url, x-fhir-access-token, x-patient-id
// These are bound to AsyncLocalStorage so every tool can read them.
//
// Why standalone server (not embedded in NestJS)?
// - MCP server is a tool provider; NestJS is an orchestrator. Separate = publishable
//   to Prompt Opinion independently + separate Lambda scaling.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response } from 'express';

import { fhirContextFromHeaders, runWithFhirContext } from './fhir/context.js';
import { registerPatientTool } from './tools/patient.tool.js';
import { registerCardiacTool } from './tools/cardiac.tool.js';
import { registerPulmonaryTool } from './tools/pulmonary.tool.js';
import { registerMetabolicTool } from './tools/metabolic.tool.js';
import { registerMedicationTool } from './tools/medication.tool.js';
import { registerDocumentsTool } from './tools/documents.tool.js';
import { registerCalculatorTools } from './tools/calculators.tool.js';
import { registerWriteTools } from './tools/write.tools.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

function buildServer(): McpServer {
  const server = new McpServer({ name: 'preop-intel-mcp', version: '1.0.0' });
  registerPatientTool(server);
  registerCardiacTool(server);
  registerPulmonaryTool(server);
  registerMetabolicTool(server);
  registerMedicationTool(server);
  registerCalculatorTools(server);
  registerWriteTools(server);
  registerDocumentsTool(server);
  return server;
}

// Stateless streamable-HTTP: a fresh server + transport per request.
// Po doesn't multiplex sessions over MCP — each tool call is independent.
app.post('/mcp', async (req: Request, res: Response) => {
  const ctx = fhirContextFromHeaders(req);
  await runWithFhirContext(ctx, async () => {
    try {
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('MCP request failed:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });
});

// Streamable-HTTP also responds to GET (server-initiated streams) and DELETE
// (close session). In stateless mode both are no-ops returning 405.
app.get('/mcp', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed in stateless mode.' },
    id: null,
  });
});

app.delete('/mcp', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed in stateless mode.' },
    id: null,
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'preop-intel-mcp', tools: 12 });
});

const PORT = parseInt(process.env.MCP_PORT ?? process.env.PORT ?? '3002', 10);

app.listen(PORT, () => {
  console.log(`PreOp Intel MCP Server running on :${PORT}`);
  console.log(`  MCP endpoint:  POST http://localhost:${PORT}/mcp  (streamable-HTTP)`);
  console.log(`  Health check:  GET  http://localhost:${PORT}/health`);
});
