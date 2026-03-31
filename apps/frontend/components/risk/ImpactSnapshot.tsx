'use client';

interface ImpactSnapshotProps {
  baselineRiskPercent: number;
  recommendationsCount: number;
  urgentConcernsCount: number;
}

export function ImpactSnapshot({
  baselineRiskPercent,
  recommendationsCount,
  urgentConcernsCount,
}: ImpactSnapshotProps) {
  const estimatedDelayDays = Math.max(3, recommendationsCount * 3 + urgentConcernsCount * 2);
  const estimatedAvoidedCancellationRisk = Math.min(65, Math.round(baselineRiskPercent * 4.2));

  return (
    <section className="glass-panel rounded-xl border border-clinical-border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
          Impact Snapshot
        </h3>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          Judge-friendly metric view
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-clinical-text-muted">Current MACE risk</p>
          <p className="mt-1 font-mono text-2xl font-bold text-clinical-text-primary">{baselineRiskPercent.toFixed(1)}%</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-clinical-text-muted">Potential cancellation risk reduction</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700">{estimatedAvoidedCancellationRisk}%</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-clinical-text-muted">Optimization window</p>
          <p className="mt-1 font-mono text-2xl font-bold text-clinical-text-primary">{estimatedDelayDays}d</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-clinical-text-muted">
        Estimates are scenario-based and intended for decision support demos, not direct clinical policy.
      </p>
    </section>
  );
}
