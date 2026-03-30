// Overall risk summary banner — appears after assessment completes.
// Shows risk level, narrative, and whether surgery can proceed.

'use client';

interface RiskBannerProps {
  overallRisk: string;
  overallRiskPercent: number;
  clinicalNarrative: string;
  safeToProceed: boolean;
  optimizationRequired: boolean;
  urgentConcerns: string[];
}

function getRiskStyles(risk: string) {
  switch (risk) {
    case 'Low': return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-800' };
    case 'Moderate': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800' };
    case 'High': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-800' };
    case 'Very High': return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-800' };
    default: return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', badge: 'bg-slate-100 text-slate-800' };
  }
}

export function RiskBanner({ overallRisk, overallRiskPercent, clinicalNarrative, safeToProceed, optimizationRequired, urgentConcerns }: RiskBannerProps) {
  const styles = getRiskStyles(overallRisk);

  return (
    <div className={`rounded-xl border-2 ${styles.border} ${styles.bg} p-6`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className={`rounded-full ${styles.badge} px-4 py-1.5 text-sm font-bold`}>
              {overallRisk} Risk
            </span>
            <span className="font-mono text-lg font-bold text-clinical-text-primary">
              {overallRiskPercent}% MACE
            </span>
          </div>

          <p className={`mt-3 text-sm ${styles.text}`}>
            {clinicalNarrative}
          </p>

          {urgentConcerns.length > 0 && (
            <ul className="mt-3 space-y-1">
              {urgentConcerns.map((concern, i) => (
                <li key={i} className={`text-sm ${styles.text} flex items-start gap-2`}>
                  <span className="mt-0.5 text-xs">⚠</span>
                  {concern}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ml-6 text-right">
          {safeToProceed ? (
            <div className="rounded-lg bg-green-100 px-4 py-2">
              <p className="text-sm font-bold text-green-800">SAFE TO PROCEED</p>
            </div>
          ) : (
            <div className="rounded-lg bg-red-100 px-4 py-2">
              <p className="text-sm font-bold text-red-800">OPTIMIZATION REQUIRED</p>
              {optimizationRequired && (
                <p className="mt-1 text-xs text-red-600">Delay recommended</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
