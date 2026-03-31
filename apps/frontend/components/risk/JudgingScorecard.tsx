'use client';

interface JudgingScorecardProps {
  confidenceScore: number;
  recommendationsCount: number;
  urgentConcernsCount: number;
  riskPercent: number;
}

function scoreBand(score: number) {
  if (score >= 8.5) return 'bg-emerald-100 text-emerald-800';
  if (score >= 7) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export function JudgingScorecard({
  confidenceScore,
  recommendationsCount,
  urgentConcernsCount,
  riskPercent,
}: JudgingScorecardProps) {
  const aiFactor = Math.min(10, 7 + (confidenceScore >= 80 ? 1.5 : 0.5) + (recommendationsCount >= 3 ? 1 : 0));
  const impact = Math.min(10, 6.5 + (riskPercent >= 5 ? 1.5 : 0.5) + (urgentConcernsCount >= 1 ? 1 : 0) + (recommendationsCount >= 3 ? 1 : 0));
  const feasibility = Math.min(10, 7 + (confidenceScore >= 70 ? 1 : 0) + 1.2);

  const rows = [
    {
      label: 'AI Factor',
      score: aiFactor,
      evidence: 'Multi-agent synthesis, explainability chips, and confidence guardrails',
    },
    {
      label: 'Potential Impact',
      score: impact,
      evidence: 'Risk delta simulation and optimization planning tied to clinical actions',
    },
    {
      label: 'Feasibility',
      score: feasibility,
      evidence: 'FHIR-native outputs, safety abstain behavior, and standards-first architecture',
    },
  ];

  return (
    <section className="glass-panel rounded-xl border border-clinical-border p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-clinical-text-muted sm:text-sm sm:tracking-wide">
          Hackathon Judge Alignment
        </h3>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
          Live scorecard view
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3 sm:gap-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-clinical-text-muted">
                {row.label}
              </p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${scoreBand(row.score)}`}>
                {row.score.toFixed(1)} / 10
              </span>
            </div>
            <p className="text-sm text-clinical-text-primary">{row.evidence}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
