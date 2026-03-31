// Semi-circle SVG risk gauge.
// Why SVG (not Recharts)? Declarative, CSS-animatable, resolution-independent.
// Recharts is overkill for a gauge — arc via stroke-dasharray on SVG <path>.
// Source: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray

'use client';

interface RiskGaugeProps {
  label: string;
  score: number;
  maxScore: number;
  riskPercent: number;
  riskCategory: string;
  detail?: string;
}

// Arc path for a semi-circle (180°). SVG arc from left to right.
const ARC_PATH = 'M 20 100 A 80 80 0 0 1 180 100';
// Total arc length for a semi-circle with radius 80
const ARC_LENGTH = Math.PI * 80; // ~251.3

function getRiskColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'very low': return '#10B981';
    case 'low': return '#22C55E';
    case 'moderate': return '#F59E0B';
    case 'high': return '#EF4444';
    case 'very high':
    case 'critical': return '#7C3AED';
    default: return '#94A3B8';
  }
}

export function RiskGauge({ label, score, maxScore, riskPercent, riskCategory, detail }: RiskGaugeProps) {
  const fillRatio = Math.min(score / maxScore, 1);
  const dashOffset = ARC_LENGTH * (1 - fillRatio);
  const color = getRiskColor(riskCategory);

  return (
    <div className="flex flex-col items-center rounded-xl border border-clinical-border bg-white p-5 sm:p-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-clinical-text-muted sm:text-sm sm:tracking-wide">
        {label}
      </h3>

      <svg viewBox="0 0 200 120" className="h-32 w-48">
        {/* Background arc */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Filled arc — animates via CSS transition */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Score text */}
        <text x="100" y="85" textAnchor="middle" className="fill-clinical-text-primary text-3xl font-bold" fontSize="32" fontWeight="700">
          {score}
        </text>
        <text x="100" y="105" textAnchor="middle" className="fill-clinical-text-muted" fontSize="12">
          / {maxScore}
        </text>
      </svg>

      <span
        className="mt-1 rounded-full px-3 py-1 text-xs font-semibold sm:text-sm"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {riskCategory}
      </span>

      <p className="mt-2 font-mono text-base font-bold text-clinical-text-primary sm:text-lg">
        {riskPercent}% risk
      </p>

      {detail && (
        <p className="mt-1 text-center text-xs text-clinical-text-muted">
          {detail}
        </p>
      )}
    </div>
  );
}
