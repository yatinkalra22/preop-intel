// FindingsPanel — extracted clinical findings from free-text notes.
// Each finding cites a verbatim source snippet that was programmatically
// verified against the source document before display.

'use client';

import type { ClinicalFinding, FindingSeverity, FindingDisplayState } from '@preop-intel/shared';

interface FindingsPanelProps {
  findings: ClinicalFinding[];
  documentCount?: number;
}

const SEVERITY_STYLES: Record<FindingSeverity, { badge: string; border: string }> = {
  low:      { badge: 'bg-slate-100 text-slate-700',   border: 'border-slate-200' },
  moderate: { badge: 'bg-amber-100 text-amber-800',   border: 'border-amber-200' },
  high:     { badge: 'bg-orange-100 text-orange-800', border: 'border-orange-200' },
  critical: { badge: 'bg-red-100 text-red-800',       border: 'border-red-300' },
};

const DISPLAY_STATE_LABEL: Record<FindingDisplayState, string> = {
  detected: 'AI-Detected',
  possible: 'Possible — Review',
  'pending-confirmation': 'Confirm with Clinician',
  hidden: 'Hidden',
};

const DISPLAY_STATE_STYLES: Record<FindingDisplayState, string> = {
  detected: 'bg-cyan-100 text-cyan-800',
  possible: 'bg-amber-100 text-amber-800',
  'pending-confirmation': 'bg-purple-100 text-purple-800',
  hidden: 'bg-slate-100 text-slate-500',
};

const CATEGORY_LABEL: Record<string, string> = {
  'medication': 'Medication',
  'cardiac-event': 'Cardiac Event',
  'functional': 'Functional Capacity',
  'respiratory': 'Respiratory',
  'metabolic': 'Metabolic',
  'other': 'Other',
};

export function FindingsPanel({ findings, documentCount }: FindingsPanelProps) {
  return (
    <div className="rounded-xl border border-clinical-border bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-clinical-text-muted sm:text-sm sm:tracking-wide">
            Findings from Clinical Notes
          </h3>
          <p className="mt-1 text-xs text-clinical-text-muted">
            Risk-relevant signals AI extracted from H&amp;P, consult letters, and outside discharge summaries.
          </p>
        </div>
        <p className="text-xs text-clinical-text-muted">
          {findings.length} finding{findings.length === 1 ? '' : 's'}
          {documentCount != null ? ` · ${documentCount} document${documentCount === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      {findings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
          <p className="text-sm font-medium text-clinical-text-primary">
            No findings extracted from notes.
          </p>
          <p className="mt-1 text-xs text-clinical-text-muted">
            All risk signals derived from structured chart data. (Live mode shows zero
            findings if the patient&apos;s chart has no DocumentReference resources.)
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => {
            const sev = SEVERITY_STYLES[f.severity];
            const dispState = (f.displayState ?? 'detected') as FindingDisplayState;
            const dispStyle = DISPLAY_STATE_STYLES[dispState];

            return (
              <div
                key={f.id}
                className={`rounded-lg border ${sev.border} bg-slate-50/40 px-4 py-3`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${sev.badge}`}
                    aria-label={`Severity: ${f.severity}`}
                  >
                    {f.severity}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-clinical-text-muted">
                    {CATEGORY_LABEL[f.category] ?? f.category}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${dispStyle}`}>
                    {DISPLAY_STATE_LABEL[dispState]}
                  </span>
                  <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] text-clinical-text-muted">
                    {Math.round(f.confidence * 100)}% confidence
                  </span>
                </div>

                <p className="mt-2 text-sm font-semibold text-clinical-text-primary">
                  {f.finding}
                </p>

                <blockquote className="mt-2 border-l-2 border-cyan-300 pl-3 text-xs italic text-clinical-text-muted">
                  &ldquo;{f.sourceSnippet}&rdquo;
                  <span className="ml-2 font-mono not-italic text-[11px] text-slate-400">
                    — {f.sourceDocumentId}
                  </span>
                </blockquote>

                <p className="mt-2 text-xs text-clinical-text-muted">
                  <span className="font-semibold text-clinical-text-primary">Implication:</span>{' '}
                  {f.riskImplication}
                </p>

                {f.guidelineRef && (
                  <p className="mt-1 text-xs text-clinical-text-muted">
                    <span className="font-semibold text-clinical-text-primary">Guideline:</span>{' '}
                    {f.guidelineRef}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
