// Agent card definitions for the five PreOp Intel agents.
//
// These are the source of truth for what gets registered on Prompt Opinion's
// marketplace. Each card describes capabilities + I/O schemas so other agents
// can discover and invoke ours.

import type { A2AAgentCard, A2AAgentName } from './a2a.types';

const VERSION = '1.0.0';

function endpoint(name: A2AAgentName, base: string): string {
  return `${base}/a2a/agents/${name}/tasks`;
}

export function buildAgentCards(baseUrl: string): Record<A2AAgentName, A2AAgentCard> {
  return {
    'note-extractor': {
      name: 'note-extractor',
      displayName: 'Clinical Note Extractor',
      description:
        'Extracts risk-relevant findings from free-text clinical documents (H&P, consult letters, discharge summaries). Every finding cites a verbatim source snippet that is programmatically verified.',
      version: VERSION,
      endpointUrl: endpoint('note-extractor', baseUrl),
      capabilities: [{
        name: 'extract',
        description: 'Extract clinical findings with verifiable citations.',
        inputSchema: {
          type: 'object',
          properties: {
            documents: { type: 'array' },
            patientContext: { type: 'object' },
            categoryFilter: { type: 'array' },
          },
          required: ['documents', 'patientContext'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            findings: { type: 'array' },
            documentCount: { type: 'number' },
            durationMs: { type: 'number' },
          },
        },
      }],
      metadata: { domain: 'pre-operative-risk', verifierEnabled: true },
    },

    cardiac: {
      name: 'cardiac',
      displayName: 'Cardiac Risk Specialist',
      description:
        'Computes the Revised Cardiac Risk Index (Lee et al. 1999) and applies routed cardiac findings (cardiac-event, medication, functional). Surfaces critical alerts (e.g., recent MI within 60 days per ACC/AHA).',
      version: VERSION,
      endpointUrl: endpoint('cardiac', baseUrl),
      capabilities: [{
        name: 'assess',
        description: 'Assess cardiac risk with structured + note-derived inputs.',
        inputSchema: {
          type: 'object',
          properties: {
            structured: { type: 'object' },
            findings: { type: 'array' },
          },
          required: ['structured'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            adjustedInput: { type: 'object' },
            overrides: { type: 'array' },
            criticalAlerts: { type: 'array' },
            findingsApplied: { type: 'array' },
          },
        },
      }],
      metadata: { domain: 'pre-operative-risk', score: 'RCRI' },
    },

    pulmonary: {
      name: 'pulmonary',
      displayName: 'Pulmonary Risk Specialist',
      description:
        'Computes ARISCAT (Canet et al. 2010) and applies routed respiratory + functional findings. Surfaces alerts for METs <4 and recent respiratory infection.',
      version: VERSION,
      endpointUrl: endpoint('pulmonary', baseUrl),
      capabilities: [{
        name: 'assess',
        description: 'Assess pulmonary risk with structured + note-derived inputs.',
        inputSchema: {
          type: 'object',
          properties: { structured: { type: 'object' }, findings: { type: 'array' } },
          required: ['structured'],
        },
        outputSchema: { type: 'object' },
      }],
      metadata: { domain: 'pre-operative-risk', score: 'ARISCAT' },
    },

    metabolic: {
      name: 'metabolic',
      displayName: 'Metabolic Risk Specialist',
      description:
        'Evaluates HbA1c, eGFR, BMI, creatinine against ADA / KDIGO thresholds and consumes metabolic + medication-related findings.',
      version: VERSION,
      endpointUrl: endpoint('metabolic', baseUrl),
      capabilities: [{
        name: 'assess',
        description: 'Assess metabolic risk with structured + note-derived inputs.',
        inputSchema: {
          type: 'object',
          properties: { structured: { type: 'object' }, findings: { type: 'array' } },
          required: ['structured'],
        },
        outputSchema: { type: 'object' },
      }],
      metadata: { domain: 'pre-operative-risk' },
    },

    orchestrator: {
      name: 'orchestrator',
      displayName: 'Pre-Op Risk Orchestrator',
      description:
        'Coordinates the note extractor and three specialists, synthesizes a clinically actionable assessment, and produces FHIR write-back payloads with SHARP provenance extensions.',
      version: VERSION,
      endpointUrl: endpoint('orchestrator', baseUrl),
      capabilities: [{
        name: 'run-assessment',
        description: 'End-to-end pre-op risk assessment for a patient.',
        inputSchema: {
          type: 'object',
          properties: {
            patientId: { type: 'string' },
            plannedProcedure: { type: 'string' },
            fhirBaseUrl: { type: 'string' },
            accessToken: { type: 'string' },
          },
          required: ['patientId', 'plannedProcedure'],
        },
        outputSchema: { type: 'object' },
      }],
      metadata: { domain: 'pre-operative-risk', primary: true },
    },
  };
}
