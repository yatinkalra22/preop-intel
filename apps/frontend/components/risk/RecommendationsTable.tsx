// Recommendations table — actionable items from the assessment.
// Each recommendation has urgency level and clinical rationale.

'use client';

import type { RiskRecommendation } from '@preop-intel/shared';

interface RecommendationEvidence {
  chips: string[];
  source: string;
}

interface RecommendationsTableProps {
  recommendations: RiskRecommendation[];
  evidence?: RecommendationEvidence[];
}

const URGENCY_STYLES: Record<string, string> = {
  'Immediate': 'bg-red-100 text-red-800',
  'Within 2 weeks': 'bg-amber-100 text-amber-800',
  'Before surgery': 'bg-blue-100 text-blue-800',
};

export function RecommendationsTable({ recommendations, evidence = [] }: RecommendationsTableProps) {
  return (
    <div className="rounded-xl border border-clinical-border bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
        Recommendations
      </h3>
      <div className="space-y-3 md:hidden">
        {recommendations.map((rec, i) => (
          <article key={`mobile-${i}`} className="rounded-lg border border-clinical-border p-3">
            <p className="text-sm font-semibold text-clinical-text-primary">{rec.action}</p>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${URGENCY_STYLES[rec.urgency] ?? 'bg-slate-100 text-slate-700'}`}>
              {rec.urgency}
            </span>
            <p className="mt-2 text-sm text-clinical-text-muted">{rec.rationale}</p>
            {evidence[i] && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {evidence[i].chips.map((chip) => (
                  <span key={`${rec.action}-${chip}`} className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      <table className="hidden w-full md:table">
        <thead>
          <tr className="border-b border-clinical-border text-left text-xs font-medium uppercase text-clinical-text-muted">
            <th className="pb-2">Action</th>
            <th className="pb-2">Urgency</th>
            <th className="pb-2">Rationale</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {recommendations.map((rec, i) => (
            <tr key={i} className="border-b border-clinical-border last:border-0">
              <td className="py-3 pr-4 font-medium text-clinical-text-primary">
                {rec.action}
                {evidence[i] && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {evidence[i].chips.map((chip) => (
                      <span
                        key={`${rec.action}-${chip}`}
                        className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="py-3 pr-4">
                <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${URGENCY_STYLES[rec.urgency] ?? 'bg-slate-100 text-slate-700'}`}>
                  {rec.urgency}
                </span>
              </td>
              <td className="py-3 text-clinical-text-muted">
                {rec.rationale}
                {evidence[i]?.source && (
                  <p className="mt-1 text-xs text-clinical-text-muted">
                    Evidence source: {evidence[i].source}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
