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

import { usePreOpStore } from '@/lib/store';
import { maskDate, maskId, maskName } from '@/lib/privacy';

export function PatientBanner({ name, age, gender, birthDate, plannedProcedure, patientId }: PatientBannerProps) {
  const privacyMode = usePreOpStore((s) => s.privacyMode);

  const displayName = privacyMode ? maskName(name) : name;
  const displayBirthDate = privacyMode ? maskDate(birthDate) : birthDate;
  const displayPatientId = privacyMode ? maskId(patientId) : patientId;

  return (
    <div className="sticky top-14 z-40 border-b border-clinical-border bg-white px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-clinical-text-primary">
              {displayName}
            </h1>
            <p className="text-sm text-clinical-text-muted">
              {age}{gender.charAt(0).toUpperCase()} &middot; DOB: {displayBirthDate} &middot; ID: {displayPatientId}
            </p>
          </div>
          <div className="sm:text-right">
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
