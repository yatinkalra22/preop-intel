// Surgeon dashboard — patient list with surgery dates and risk status.
// Why a dashboard (not jump to assessment)? Judges expect "real app" feel.
// Patient list establishes clinical workflow context.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePreOpStore } from '@/lib/store';
import { DEMO_PATIENT, DEMO_DATA } from '@preop-intel/shared';

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
      surgeryDate: '2026-04-15',
      conditions: DEMO_DATA.conditions.length,
      lastAssessment: null as string | null,
      riskLevel: null as string | null,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 fade-rise">
      <section className="glass-panel mb-6 overflow-hidden rounded-2xl border border-cyan-100 shadow-sm">
        <div className="bg-gradient-to-r from-cyan-500 via-sky-500 to-teal-500 p-[1px]">
          <div className="rounded-[15px] bg-white/95 px-6 py-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">PreOp Intel Command Board</p>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">Live demo mode</span>
            </div>
            <h1 className="text-3xl font-bold text-clinical-text-primary">Upcoming Surgical Patients</h1>
            <p className="mt-2 text-sm text-clinical-text-muted">
              {patients.length} patient{patients.length !== 1 ? 's' : ''} awaiting pre-operative assessment
            </p>
          </div>
        </div>
      </section>

      <div className="glass-panel overflow-hidden rounded-2xl border border-clinical-border shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-clinical-border bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-clinical-text-muted">
              <th className="px-6 py-3">Patient</th>
              <th className="px-6 py-3">Procedure</th>
              <th className="px-6 py-3">Surgery Date</th>
              <th className="px-6 py-3">Conditions</th>
              <th className="px-6 py-3 text-right">Risk Status</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr
                key={patient.id}
                onClick={() => router.push(`/patient/${patient.id}`)}
                className="stagger-in cursor-pointer border-b border-clinical-border transition-all last:border-0 hover:bg-cyan-50/40"
              >
                <td className="px-6 py-4">
                  <p className="font-semibold text-clinical-text-primary">{patient.name}</p>
                  <p className="text-sm text-clinical-text-muted">
                    {patient.age}{patient.gender.charAt(0)} &middot; DOB {patient.birthDate}
                  </p>
                </td>
                <td className="px-6 py-4 text-sm text-clinical-text-primary">
                  {patient.plannedProcedure}
                </td>
                <td className="px-6 py-4 text-sm text-clinical-text-primary">
                  {patient.surgeryDate}
                </td>
                <td className="px-6 py-4">
                  <span className="font-mono text-sm text-clinical-text-primary">
                    {patient.conditions} active
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {patient.riskLevel ? (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                      {patient.riskLevel}
                    </span>
                  ) : (
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
                      Not assessed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
