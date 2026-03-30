// FHIR Resource Viewer — shows raw JSON of written FHIR resources.
// Why show raw JSON? Proves to judges we're writing real FHIR R4 resources,
// not just displaying text. This is a key differentiator for the demo.

'use client';

import { useState } from 'react';

interface FhirResource {
  resourceType: string;
  label: string;
  resource: object;
}

interface FhirResourceViewerProps {
  resources: FhirResource[];
}

export function FhirResourceViewer({ resources }: FhirResourceViewerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-clinical-border bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
        FHIR Resources Written to Chart
      </h3>
      <div className="space-y-2">
        {resources.map((r) => (
          <div key={r.resourceType} className="rounded-lg border border-clinical-border">
            <button
              onClick={() => setExpanded(expanded === r.resourceType ? null : r.resourceType)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <span className="rounded bg-clinical-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-clinical-accent">
                  {r.resourceType}
                </span>
                <span className="text-sm text-clinical-text-primary">{r.label}</span>
              </div>
              <span className="text-clinical-text-muted">
                {expanded === r.resourceType ? '▲' : '▼'}
              </span>
            </button>
            {expanded === r.resourceType && (
              <div className="border-t border-clinical-border bg-slate-50 p-4">
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs text-clinical-text-primary">
                  {JSON.stringify(r.resource, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
