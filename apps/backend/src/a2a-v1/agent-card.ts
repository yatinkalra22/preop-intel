// Agent card for the PreOp Intel orchestrator, A2A protocol v0.3.0.
// Built per Po's expectations:
//  - protocolVersion 0.3.0
//  - preferredTransport JSONRPC
//  - extensions[] declares the FHIR-context URI Po sends in metadata
//  - securitySchemes declares X-API-Key

import type { AgentCard } from '@a2a-js/sdk';

export interface AgentCardOptions {
  url: string;
  fhirExtensionUri: string;
  requireApiKey: boolean;
}

export function buildOrchestratorAgentCard(opts: AgentCardOptions): AgentCard {
  const { url, fhirExtensionUri, requireApiKey } = opts;

  const securitySchemes = requireApiKey
    ? {
      apiKey: {
        type: 'apiKey' as const,
        name: 'X-API-Key',
        in: 'header' as const,
        description: 'API key required to invoke the orchestrator.',
      },
    }
    : undefined;

  const security = requireApiKey ? [{ apiKey: [] as string[] }] : undefined;

  return {
    name: 'preop_intel_orchestrator',
    description:
      'Pre-operative risk orchestrator. Accepts a structured assessment request '
      + '(planned procedure, risk-calculator inputs, extracted clinical findings) and '
      + 'returns a deterministic risk artifact: RCRI, ARISCAT, metabolic risk, cancellation '
      + 'cost band, and SHARP-provenance write-back payloads. No LLM calls inside the agent — '
      + 'reasoning belongs in the upstream Po BYO agent that prepared the inputs.',
    url,
    version: '1.0.0',
    protocolVersion: '0.3.0',
    preferredTransport: 'JSONRPC',
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
      extensions: [
        {
          uri: fhirExtensionUri,
          description: "FHIR R4 context — used for SHARP-provenance write-backs against the patient's FHIR server.",
          required: false,
        },
      ],
    },
    skills: [
      {
        id: 'assess-preoperative-risk',
        name: 'Assess pre-operative risk',
        description:
          'Run the full pre-op risk pipeline against structured inputs and findings. '
          + 'Returns RCRI, ARISCAT, metabolic risk, cancellation cost, preventable issues, '
          + 'and a FHIR write-back bundle with SHARP provenance extensions.',
        tags: ['healthcare', 'pre-operative', 'risk-stratification', 'fhir', 'sharp'],
        examples: [
          'Run a pre-op assessment for the current patient using these RCRI/ARISCAT/metabolic inputs and findings.',
          'Score cancellation risk for a hip replacement scheduled in 5 days.',
        ],
      },
    ],
    ...(securitySchemes && { securitySchemes }),
    ...(security && { security }),
  };
}
