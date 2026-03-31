'use client';

interface SafetyGuardrailProps {
  confidenceScore: number;
  missingFields: string[];
  abstain: boolean;
}

export function SafetyGuardrail({ confidenceScore, missingFields, abstain }: SafetyGuardrailProps) {
  const barColor =
    confidenceScore >= 85
      ? 'bg-green-500'
      : confidenceScore >= 65
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <section className="rounded-xl border border-clinical-border bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
          Safety Guardrail
        </h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Confidence {confidenceScore}%
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-200">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${confidenceScore}%` }}
        />
      </div>

      {abstain ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          High-confidence recommendation withheld until critical missing data is available.
        </div>
      ) : (
        <p className="mt-4 text-sm text-clinical-text-primary">
          Recommendation confidence is sufficient for decision support.
        </p>
      )}

      {missingFields.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-clinical-text-muted">
            Missing or stale inputs
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingFields.map((field) => (
              <span key={field} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {field}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
