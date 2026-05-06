// CancellationPanel — surfaces same-day cancellation risk with a deterministic
// dollar band, severity-driven score, and an LLM-generated owner-tagged action
// plan. Numbers are auditable: cost is a band (low/high), score weights live in
// shared/cancellation.types.ts with literature citations.

'use client';

import type { CancellationRisk, PreventableIssue } from '@preop-intel/shared';

interface CancellationPanelProps {
  cancellationRisk: CancellationRisk;
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function scoreColor(score: number): { bg: string; text: string; border: string; label: string } {
  if (score >= 70) return { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', label: 'High Cancellation Risk' };
  if (score >= 40) return { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', label: 'Moderate Cancellation Risk' };
  if (score >= 15) return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', label: 'Low Cancellation Risk' };
  return { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', label: 'Minimal Cancellation Risk' };
}

const OWNER_LABEL: Record<PreventableIssue['owner'], string> = {
  anesthesia: 'Anesthesia',
  surgery: 'Surgery',
  patient: 'Patient',
  'primary-care': 'Primary Care',
  cardiology: 'Cardiology',
  endocrinology: 'Endocrinology',
};

export function CancellationPanel({ cancellationRisk }: CancellationPanelProps) {
  const sc = scoreColor(cancellationRisk.score);
  const issuesByOwner = new Map<string, PreventableIssue[]>();
  for (const issue of cancellationRisk.preventableIssues) {
    const list = issuesByOwner.get(issue.owner) ?? [];
    list.push(issue);
    issuesByOwner.set(issue.owner, list);
  }

  return (
    <div className={`rounded-xl border-2 ${sc.border} ${sc.bg} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${sc.text}`}>
            {sc.label}
          </p>
          <h3 className="mt-1 text-lg font-bold text-clinical-text-primary sm:text-xl">
            Same-Day Cancellation Avoidance
          </h3>
          <p className="mt-1 text-xs text-clinical-text-muted">
            {cancellationRisk.inputs.daysToSurgery} day{cancellationRisk.inputs.daysToSurgery === 1 ? '' : 's'} until surgery ·{' '}
            {cancellationRisk.preventableIssues.length} preventable issue{cancellationRisk.preventableIssues.length === 1 ? '' : 's'} ·{' '}
            score {cancellationRisk.score}/100
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-clinical-text-muted">Estimated cost avoidance</p>
          <p className="mt-1 font-mono text-xl font-bold text-clinical-text-primary sm:text-2xl">
            {formatUsd(cancellationRisk.estimatedCostAvoidanceLow)} – {formatUsd(cancellationRisk.estimatedCostAvoidanceHigh)}
          </p>
          <p className="mt-1 text-[11px] text-clinical-text-muted">
            Based on Macario 2010 OR-cost literature, surgery-specific.
          </p>
        </div>
      </div>

      {cancellationRisk.preventableIssues.length > 0 && (
        <div className="mt-5 rounded-lg bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-clinical-text-muted">
            Preventable Issues by Owner
          </p>
          <div className="space-y-3">
            {Array.from(issuesByOwner.entries()).map(([owner, issues]) => (
              <div key={owner}>
                <p className="text-xs font-semibold text-clinical-text-primary">
                  {OWNER_LABEL[owner as PreventableIssue['owner']] ?? owner}
                </p>
                <ul className="mt-1 space-y-1">
                  {issues.map((i) => (
                    <li key={i.id} className="flex items-start gap-2 text-xs text-clinical-text-muted">
                      <span className="mt-0.5 inline-block min-w-[68px] rounded bg-slate-100 px-1.5 py-0.5 text-center font-mono text-[10px] text-clinical-text-primary">
                        ≤ {i.daysToFix}d
                      </span>
                      <span>
                        <span className="font-medium text-clinical-text-primary">{i.issue}</span> — {i.action}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {cancellationRisk.actionPlan && cancellationRisk.actionPlan.trim().length > 0 && (
        <div className="mt-4 rounded-lg bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clinical-text-muted">
            Coordinated Action Plan
          </p>
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-clinical-text-primary">
            {cancellationRisk.actionPlan}
          </pre>
        </div>
      )}
    </div>
  );
}
