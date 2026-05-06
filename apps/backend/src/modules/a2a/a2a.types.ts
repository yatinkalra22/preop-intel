// A2A protocol types. Minimal surface for sync request/response.
//
// We register all five PreOp Intel agents with agent cards, expose them at
// /a2a/agents/{name}/.well-known/agent.json, and accept tasks at
// /a2a/agents/{name}/tasks. Identical results as the in-process pipeline,
// but the orchestrator-to-specialist hop is real HTTP — visible in the
// DevTools network panel during the demo.
//
// We do NOT implement task streaming, multi-step workflows, or polling.
// The hackathon demo needs sync request/response with audit-grade traffic.

export type A2AAgentName =
  | 'note-extractor'
  | 'cardiac'
  | 'pulmonary'
  | 'metabolic'
  | 'orchestrator';

export interface A2AAgentCapability {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  outputSchema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
}

export interface A2AAgentCard {
  name: A2AAgentName;
  displayName: string;
  description: string;
  version: string;
  endpointUrl: string;
  capabilities: A2AAgentCapability[];
  metadata?: Record<string, unknown>;
}

export interface A2ATaskRequest {
  taskId: string;
  agentName: A2AAgentName;
  input: unknown;
  context?: {
    assessmentId?: string;
    correlationId?: string;
    requestedBy?: A2AAgentName;
  };
}

export interface A2ATaskResponse<T = unknown> {
  taskId: string;
  agentName: A2AAgentName;
  status: 'completed' | 'failed';
  artifact?: T;
  error?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}
