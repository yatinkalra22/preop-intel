// Patient overview page — shows clinical summary before starting assessment.
// Why a separate page (not jump straight to assessment)? Establishes clinical
// workflow context. Surgeons review patient data, then choose to assess.

'use client';

import { useParams, useRouter } from 'next/navigation';
import { DEMO_PATIENT, DEMO_DATA } from '@preop-intel/shared';
import { PatientBanner } from '@/components/layout/PatientBanner';
import { JourneyStepper } from '@/components/layout/JourneyStepper';

export default function PatientOverviewPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const patient = DEMO_PATIENT;
  const data = DEMO_DATA;

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
        <JourneyStepper currentStep={2} />

        {/* Breadcrumb navigation */}
        <nav className="mb-6 text-sm text-clinical-text-muted">
          <button onClick={() => router.push('/dashboard')} className="hover:text-clinical-accent">
            Dashboard
          </button>
          <span className="mx-2">/</span>
          <span className="text-clinical-text-primary">{patient.name}</span>
        </nav>

        {/* Action bar */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-xl font-bold text-clinical-text-primary">
            Clinical Summary
          </h2>
          <button
            onClick={() => router.push(`/patient/${patientId}/assessment`)}
            className="rounded-lg bg-clinical-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-clinical-accent-dark"
          >
            Start PreOp Assessment
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Next step: run the assessment to generate recommendations and write structured FHIR resources.
        </div>

        {/* Grid layout — 2 columns on desktop */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Active Conditions */}
          <section className="rounded-xl border border-clinical-border bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
              Active Conditions
            </h3>
            <ul className="space-y-3">
              {data.conditions.map((c) => (
                <li key={c.code} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-clinical-text-primary">
                    {c.name}
                  </span>
                  <span className="font-mono text-xs text-clinical-text-muted">
                    {c.code}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Current Medications */}
          <section className="rounded-xl border border-clinical-border bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
              Current Medications
            </h3>
            <ul className="space-y-3">
              {data.medications.map((m) => (
                <li key={m.name} className="flex items-center justify-between">
                  <span className="text-sm text-clinical-text-primary">
                    {m.name}
                  </span>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    {m.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Recent Labs */}
          <section className="rounded-xl border border-clinical-border bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
              Recent Lab Results
            </h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-clinical-border text-left text-xs font-medium uppercase text-clinical-text-muted">
                  <th className="pb-2">Test</th>
                  <th className="pb-2 text-right">Value</th>
                  <th className="pb-2 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {data.recentLabs.map((lab) => (
                  <tr key={lab.name} className="border-b border-clinical-border last:border-0">
                    <td className="py-2 text-clinical-text-primary">{lab.name}</td>
                    <td className="py-2 text-right">
                      <span
                        className={`font-mono font-medium ${
                          lab.flag === 'high'
                            ? 'text-risk-high'
                            : lab.flag === 'low'
                              ? 'text-risk-moderate'
                              : 'text-clinical-text-primary'
                        }`}
                      >
                        {lab.value} {lab.unit}
                      </span>
                    </td>
                    <td className="py-2 text-right text-clinical-text-muted">
                      {lab.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Allergies */}
          <section className="rounded-xl border border-clinical-border bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
              Allergies
            </h3>
            {data.allergies.length > 0 ? (
              <ul className="space-y-3">
                {data.allergies.map((a) => (
                  <li key={a.substance} className="flex items-center gap-3">
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                      ALLERGY
                    </span>
                    <span className="text-sm text-clinical-text-primary">
                      {a.substance}
                    </span>
                    <span className="text-xs text-clinical-text-muted">
                      Reaction: {a.reaction}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-clinical-text-muted">No known allergies</p>
            )}

            {/* Medication Flags */}
            <h3 className="mb-4 mt-6 text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
              Medication Flags
            </h3>
            <ul className="space-y-3">
              {data.medication.flags.map((f) => (
                <li key={f.medication} className="rounded-lg bg-amber-50 p-3">
                  <p className="text-sm font-medium text-clinical-text-primary">
                    {f.medication}
                  </p>
                  <p className="mt-1 text-xs text-risk-moderate">{f.concern}</p>
                  <p className="mt-1 text-xs text-clinical-text-muted">
                    {f.recommendation}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
