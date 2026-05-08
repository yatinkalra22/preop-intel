// Per-request FHIR context for the MCP server.
//
// Po sends FHIR credentials as HTTP headers on each /mcp request:
//   x-fhir-server-url, x-fhir-access-token, x-patient-id
// We bind those to AsyncLocalStorage so every tool handler in the same
// request can call getFhirContext() without threading them through args.
//
// Tools may also accept the same three values as explicit Zod inputs to
// support callers that don't run behind Po (existing tests, ad-hoc curl).
// resolveFhirContext() merges the two: explicit args win, headers fill gaps.

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';

export interface FhirContext {
  fhirBaseUrl: string;
  accessToken: string;
  patientId: string;
}

const storage = new AsyncLocalStorage<Partial<FhirContext>>();

export function fhirContextFromHeaders(req: Request): Partial<FhirContext> {
  const get = (name: string): string | undefined => {
    const v = req.headers[name];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  return {
    fhirBaseUrl: get('x-fhir-server-url'),
    accessToken: get('x-fhir-access-token'),
    patientId: get('x-patient-id'),
  };
}

export function runWithFhirContext<T>(ctx: Partial<FhirContext>, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getFhirContext(): Partial<FhirContext> {
  return storage.getStore() ?? {};
}

export function resolveFhirContext(args: Partial<FhirContext>): FhirContext {
  const ambient = getFhirContext();
  const fhirBaseUrl = args.fhirBaseUrl ?? ambient.fhirBaseUrl;
  const accessToken = args.accessToken ?? ambient.accessToken;
  const patientId = args.patientId ?? ambient.patientId;

  const missing = [
    !fhirBaseUrl && 'fhirBaseUrl/x-fhir-server-url',
    !accessToken && 'accessToken/x-fhir-access-token',
    !patientId && 'patientId/x-patient-id',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`FHIR context missing: ${missing.join(', ')}`);
  }

  return { fhirBaseUrl: fhirBaseUrl!, accessToken: accessToken!, patientId: patientId! };
}
