'use client';

// Why sticky? Clinical apps must always show patient context to prevent
// wrong-patient errors. This is a Joint Commission safety requirement.

interface PatientBannerProps {
  name: string;
  age: number;
  gender: string;
  birthDate: string;
  plannedProcedure: string;
  patientId: string;
}

export function PatientBanner({ name, age, gender, birthDate, plannedProcedure, patientId }: PatientBannerProps) {
  return (
    <div className="sticky top-14 z-40 border-b border-clinical-border bg-white px-6 py-3">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-clinical-text-primary">
              {name}
            </h1>
            <p className="text-sm text-clinical-text-muted">
              {age}{gender.charAt(0).toUpperCase()} &middot; DOB: {birthDate} &middot; ID: {patientId}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-clinical-text-primary">
              Planned Procedure
            </p>
            <p className="text-sm text-clinical-accent-dark">{plannedProcedure}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
