// Assessment page — placeholder for Phase 10.
// This will be the core demo screen with risk gauges, agent panel, etc.

'use client';

import { useParams } from 'next/navigation';
import { PatientBanner } from '@/components/layout/PatientBanner';
import { DEMO_PATIENT } from '@preop-intel/shared';

export default function AssessmentPage() {
  const { patientId } = useParams<{ patientId: string }>();

  // For now, use demo patient data
  const patient = DEMO_PATIENT;

  return (
    <div>
      <PatientBanner
        name={patient.name}
        age={patient.age}
        gender={patient.gender}
        birthDate={patient.birthDate}
        plannedProcedure={patient.plannedProcedure}
        patientId={patientId}
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-clinical-text-muted">
          Assessment UI will be built in Phase 10.
          Patient: {patientId}
        </p>
      </div>
    </div>
  );
}
