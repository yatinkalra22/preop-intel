// Recommendations table — actionable items from the assessment.
// Each recommendation has urgency level and clinical rationale.

'use client';

import type { RiskRecommendation } from '@preop-intel/shared';

interface RecommendationsTableProps {
  recommendations: RiskRecommendation[];
}

const URGENCY_STYLES: Record<string, string> = {
  'Immediate': 'bg-red-100 text-red-800',
  'Within 2 weeks': 'bg-amber-100 text-amber-800',
  'Before surgery': 'bg-blue-100 text-blue-800',
};

export function RecommendationsTable({ recommendations }: RecommendationsTableProps) {
  return (
    <div className="rounded-xl border border-clinical-border bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
        Recommendations
      </h3>
      <table className="w-full">
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
              </td>
              <td className="py-3 pr-4">
                <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${URGENCY_STYLES[rec.urgency] ?? 'bg-slate-100 text-slate-700'}`}>
                  {rec.urgency}
                </span>
              </td>
              <td className="py-3 text-clinical-text-muted">
                {rec.rationale}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
