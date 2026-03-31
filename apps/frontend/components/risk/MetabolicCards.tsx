// Metabolic risk indicator cards — HbA1c, eGFR, BMI, Creatinine.
// Uses JetBrains Mono for clinical values (readability at a glance).

'use client';

interface MetabolicValue {
  value: number | null;
  unit: string;
  riskFlag: boolean;
}

interface MetabolicCardsProps {
  hba1c: MetabolicValue;
  egfr: MetabolicValue;
  bmi: MetabolicValue;
  creatinine: MetabolicValue;
}

const CARD_CONFIG = [
  { key: 'hba1c' as const, label: 'HbA1c', threshold: '< 8.5%', desc: 'Glycemic control' },
  { key: 'egfr' as const, label: 'eGFR', threshold: '> 60 mL/min', desc: 'Renal function' },
  { key: 'bmi' as const, label: 'BMI', threshold: '18.5 – 40', desc: 'Body mass index' },
  { key: 'creatinine' as const, label: 'Creatinine', threshold: '< 2.0 mg/dL', desc: 'Renal marker' },
];

export function MetabolicCards({ hba1c, egfr, bmi, creatinine }: MetabolicCardsProps) {
  const values = { hba1c, egfr, bmi, creatinine };

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {CARD_CONFIG.map((card) => {
        const val = values[card.key];
        return (
          <div
            key={card.key}
            className={`rounded-xl border p-4 sm:p-5 ${
              val.riskFlag
                ? 'border-red-200 bg-red-50'
                : 'border-clinical-border bg-white'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-clinical-text-muted">
              {card.label}
            </p>
            <p className={`mt-2 font-mono text-xl font-bold sm:text-2xl ${
              val.riskFlag ? 'text-risk-high' : 'text-clinical-text-primary'
            }`}>
              {val.value ?? '—'}
              <span className="ml-1 text-xs font-normal text-clinical-text-muted">
                {val.unit}
              </span>
            </p>
            <p className="mt-1 text-xs text-clinical-text-muted">
              {card.desc} &middot; Target: {card.threshold}
            </p>
          </div>
        );
      })}
    </div>
  );
}
