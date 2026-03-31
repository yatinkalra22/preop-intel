'use client';

interface StepItem {
  label: string;
  hint: string;
}

interface JourneyStepperProps {
  currentStep: 1 | 2 | 3;
}

const STEPS: StepItem[] = [
  { label: 'Select Patient', hint: 'Dashboard triage queue' },
  { label: 'Review Context', hint: 'Clinical summary' },
  { label: 'Run Assessment', hint: 'Agentic risk + plan' },
];

export function JourneyStepper({ currentStep }: JourneyStepperProps) {
  return (
    <div className="mb-6 rounded-xl border border-clinical-border bg-white p-4 sm:p-5">
      <div className="grid gap-2.5 md:grid-cols-3 sm:gap-3">
        {STEPS.map((step, idx) => {
          const stepNo = idx + 1;
          const isCurrent = stepNo === currentStep;
          const isDone = stepNo < currentStep;

          return (
            <div key={step.label} className="flex items-start gap-3 rounded-lg px-2 py-1.5">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  isDone
                    ? 'bg-emerald-100 text-emerald-800'
                    : isCurrent
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isDone ? '✓' : stepNo}
              </span>
              <div>
                <p className={`text-sm font-semibold ${isCurrent ? 'text-clinical-text-primary' : 'text-clinical-text-muted'}`}>
                  {step.label}
                </p>
                <p className="text-xs text-clinical-text-muted">{step.hint}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
