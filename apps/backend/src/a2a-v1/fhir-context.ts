// Extracts FHIR credentials from an A2A message's metadata.
//
// Po sends FHIR context under a metadata key whose URI ends with
// "/schemas/a2a/v1/fhir-context". The same URI must appear as an
// AgentExtension in the agent card so Po knows we accept it.
//
// Shape (per https://docs.promptopinion.ai/fhir-context/a2a-fhir-context):
//   {
//     fhirUrl: string,
//     fhirToken: string,
//     patientId: string,
//     fhirRefreshToken?: string,
//     fhirRefreshTokenUrl?: string,
//   }

import type { Message } from '@a2a-js/sdk';

const FHIR_CONTEXT_KEY_SUFFIX = 'fhir-context';

export interface FhirContext {
  fhirUrl: string;
  fhirToken: string;
  patientId: string;
  fhirRefreshToken?: string;
  fhirRefreshTokenUrl?: string;
}

function tryParseObject(value: unknown): Record<string, string> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      // not JSON
    }
  }
  return null;
}

export function extractFhirContext(message: Message): FhirContext | null {
  const meta = (message.metadata ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(meta)) {
    if (!key.includes(FHIR_CONTEXT_KEY_SUFFIX)) continue;
    const obj = tryParseObject(value);
    if (!obj) continue;
    const fhirUrl = obj.fhirUrl;
    const fhirToken = obj.fhirToken;
    const patientId = obj.patientId;
    if (fhirUrl && fhirToken && patientId) {
      return {
        fhirUrl,
        fhirToken,
        patientId,
        fhirRefreshToken: obj.fhirRefreshToken,
        fhirRefreshTokenUrl: obj.fhirRefreshTokenUrl,
      };
    }
  }
  return null;
}
