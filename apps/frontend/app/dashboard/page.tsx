'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePreOpStore } from '@/lib/store';
import { DEMO_PATIENT } from '@preop-intel/shared';

export default function DashboardPage() {
  const router = useRouter();
  const isDemoMode = usePreOpStore((s) => s.isDemoMode);
  const enableDemoMode = usePreOpStore((s) => s.enableDemoMode);

  useEffect(() => {
    if (!isDemoMode) enableDemoMode();
  }, [isDemoMode, enableDemoMode]);

  const patients = [
    {
      ...DEMO_PATIENT,
      lastAssessment: null as string | null,
      riskLevel: null as string | null,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-clinical-text-primary">
        Upcoming Surgical Patients
      </h1>

      <div className="space-y-4">
        {patients.map((patient) => (
          <button
            key={patient.id}
            onClick={() => router.push(`/patient/${patient.id}`)}
            className="w-full rounded-xl border border-clinical-border bg-white p-6 text-left transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-clinical-text-primary">
                  {patient.name}
                </h2>
                <p className="text-sm text-clinical-text-muted">
                  {patient.age}{patient.gender.charAt(0)} &middot; {patient.plannedProcedure}
                </p>
              </div>
              <div className="text-right">
                {patient.riskLevel ? (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                    {patient.riskLevel}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
                    Not assessed
                  </span>
                )}
                <p className="mt-1 text-xs text-clinical-text-muted">
                  Click to assess
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
