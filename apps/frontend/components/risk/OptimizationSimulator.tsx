'use client';

import { useMemo, useState } from 'react';

interface OptimizationSimulatorProps {
  baselineRiskPercent: number;
  baselineHbA1c: number | null;
  baselineCreatinine: number | null;
}

function riskCategory(percent: number): 'Low' | 'Moderate' | 'High' | 'Very High' {
  if (percent < 1) return 'Low';
  if (percent < 5) return 'Moderate';
  if (percent < 10) return 'High';
  return 'Very High';
}

export function OptimizationSimulator({
  baselineRiskPercent,
  baselineHbA1c,
  baselineCreatinine,
}: OptimizationSimulatorProps) {
  const [targetHbA1c, setTargetHbA1c] = useState(baselineHbA1c ?? 8.8);
  const [targetCreatinine, setTargetCreatinine] = useState(baselineCreatinine ?? 1.8);
  const [surgeryDurationHours, setSurgeryDurationHours] = useState(2.5);
  const [medicationReviewed, setMedicationReviewed] = useState(false);

  const projection = useMemo(() => {
    let projected = baselineRiskPercent;

    projected += targetHbA1c <= 8.5 ? -1.8 : 1.2;
    projected += targetCreatinine < 2.0 ? -0.8 : 1.0;

    if (surgeryDurationHours <= 2) projected -= 0.6;
    if (surgeryDurationHours > 4) projected += 1.1;

    if (medicationReviewed) projected -= 0.5;

    projected = Math.max(0.3, Math.min(25, projected));
    const delta = projected - baselineRiskPercent;

    const canProceed = projected < 5 && targetHbA1c <= 8.5 && targetCreatinine < 2.0;

    return {
      projected,
      delta,
      category: riskCategory(projected),
      canProceed,
      readinessWindow: canProceed ? '7-14 days' : '2-6 weeks',
    };
  }, [baselineRiskPercent, medicationReviewed, surgeryDurationHours, targetCreatinine, targetHbA1c]);

  const deltaClass = projection.delta <= 0 ? 'text-green-700' : 'text-red-700';
  const badgeClass =
    projection.category === 'Low'
      ? 'bg-green-100 text-green-800'
      : projection.category === 'Moderate'
        ? 'bg-amber-100 text-amber-800'
        : projection.category === 'High'
          ? 'bg-red-100 text-red-800'
          : 'bg-fuchsia-100 text-fuchsia-800';

  return (
    <section className="glass-panel rounded-xl border border-clinical-border p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-clinical-text-muted sm:text-sm sm:tracking-wide">
          What-If Optimization Simulator
        </h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          Projected {projection.category}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 sm:gap-6">
        <div className="space-y-4">
          <label className="block">
            <div className="mb-1 flex justify-between text-xs text-clinical-text-muted">
              <span>Target HbA1c (%)</span>
              <span className="font-mono">{targetHbA1c.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={6}
              max={11}
              step={0.1}
              value={targetHbA1c}
              onChange={(e) => setTargetHbA1c(parseFloat(e.target.value))}
              className="w-full"
            />
          </label>

          <label className="block">
            <div className="mb-1 flex justify-between text-xs text-clinical-text-muted">
              <span>Target Creatinine (mg/dL)</span>
              <span className="font-mono">{targetCreatinine.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={3.2}
              step={0.1}
              value={targetCreatinine}
              onChange={(e) => setTargetCreatinine(parseFloat(e.target.value))}
              className="w-full"
            />
          </label>

          <label className="block">
            <div className="mb-1 flex justify-between text-xs text-clinical-text-muted">
              <span>Planned Surgery Duration (hours)</span>
              <span className="font-mono">{surgeryDurationHours.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={0.5}
              value={surgeryDurationHours}
              onChange={(e) => setSurgeryDurationHours(parseFloat(e.target.value))}
              className="w-full"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-clinical-text-primary">
            <input
              type="checkbox"
              checked={medicationReviewed}
              onChange={(e) => setMedicationReviewed(e.target.checked)}
            />
            Medication reconciliation completed
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-clinical-text-muted">Projected Outcome</p>
          <p className="mt-2 font-mono text-2xl font-bold text-clinical-text-primary sm:text-3xl">
            {projection.projected.toFixed(1)}%
          </p>
          <p className={`mt-1 text-sm font-semibold ${deltaClass}`}>
            {projection.delta <= 0 ? '' : '+'}{projection.delta.toFixed(1)}% vs current
          </p>

          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-clinical-text-primary">
            <p>
              {projection.canProceed
                ? 'Projected readiness: safe to proceed after optimization.'
                : 'Projected readiness: additional optimization required before surgery.'}
            </p>
            <p className="mt-1 text-clinical-text-muted">
              Expected readiness window: {projection.readinessWindow}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
