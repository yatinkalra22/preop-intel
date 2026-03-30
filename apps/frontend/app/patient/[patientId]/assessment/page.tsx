// Assessment page — the core demo screen.
// Flow: Click "Start Assessment" → agents animate → gauges fill → risk banner
// appears → recommendations table → FHIR resources shown. ~15-30 seconds.
//
// In demo mode, we simulate the SSE stream with timed state transitions.
// In production, this would use EventSource to /api/assessments/:id/stream.

'use client';

import { useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DEMO_PATIENT, DEMO_DATA, DEMO_FHIR_RESOURCES } from '@preop-intel/shared';
import type { AgentName, AgentStatus } from '@preop-intel/shared';
import { PatientBanner } from '@/components/layout/PatientBanner';
import { AgentStatusPanel } from '@/components/agents/AgentStatusPanel';
import { RiskGauge } from '@/components/risk/RiskGauge';
import { RiskBanner } from '@/components/risk/RiskBanner';
import { MetabolicCards } from '@/components/risk/MetabolicCards';
import { RecommendationsTable } from '@/components/risk/RecommendationsTable';
import { FhirResourceViewer } from '@/components/fhir/FhirResourceViewer';

interface AgentState {
  name: AgentName;
  displayName: string;
  description: string;
  status: AgentStatus;
  durationMs?: number;
}

const INITIAL_AGENTS: AgentState[] = [
  { name: 'cardiac', displayName: 'Cardiac Risk Agent', description: 'RCRI calculation from FHIR conditions + observations', status: 'idle' },
  { name: 'pulmonary', displayName: 'Pulmonary Risk Agent', description: 'ARISCAT score from SpO2, hemoglobin, patient age', status: 'idle' },
  { name: 'metabolic', displayName: 'Metabolic Risk Agent', description: 'HbA1c, eGFR, BMI, medication flags', status: 'idle' },
  { name: 'orchestrator', displayName: 'Orchestrator Agent', description: 'Claude AI synthesis + FHIR resource writes', status: 'idle' },
];

// Demo timing — artificial delays so agents don't look fake.
// Cardiac/Pulmonary/Metabolic run "in parallel", orchestrator after.
const DEMO_TIMELINE = [
  { agents: ['cardiac', 'pulmonary', 'metabolic'], action: 'running' as const, delay: 0 },
  { agents: ['cardiac'], action: 'complete' as const, delay: 1200, durationMs: 1200 },
  { agents: ['pulmonary'], action: 'complete' as const, delay: 1800, durationMs: 1800 },
  { agents: ['metabolic'], action: 'complete' as const, delay: 2200, durationMs: 2200 },
  { agents: ['orchestrator'], action: 'running' as const, delay: 2500 },
  { agents: ['orchestrator'], action: 'complete' as const, delay: 5000, durationMs: 2500 },
];

export default function AssessmentPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const patient = DEMO_PATIENT;
  const result = DEMO_DATA.assessmentResult;

  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS);
  const [phase, setPhase] = useState<'idle' | 'running' | 'complete'>('idle');
  const [showResults, setShowResults] = useState(false);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const startDemo = useCallback(() => {
    setAgents(INITIAL_AGENTS);
    setPhase('running');
    setShowResults(false);

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    for (const step of DEMO_TIMELINE) {
      const t = setTimeout(() => {
        setAgents((prev) =>
          prev.map((a) =>
            step.agents.includes(a.name)
              ? { ...a, status: step.action, durationMs: step.durationMs ?? a.durationMs }
              : a
          )
        );
      }, step.delay);
      timeoutsRef.current.push(t);
    }

    const t = setTimeout(() => {
      setPhase('complete');
      setShowResults(true);
    }, 5500);
    timeoutsRef.current.push(t);
  }, []);

  const fhirResources = [
    { resourceType: 'RiskAssessment', label: 'Perioperative Risk Assessment', resource: DEMO_FHIR_RESOURCES.riskAssessment },
    { resourceType: 'CarePlan', label: 'Optimization Plan', resource: DEMO_FHIR_RESOURCES.carePlan },
    { resourceType: 'Flag', label: 'High-Risk Patient Alert', resource: DEMO_FHIR_RESOURCES.flag },
    { resourceType: 'ServiceRequest', label: 'Endocrinology Referral', resource: DEMO_FHIR_RESOURCES.serviceRequest },
  ];

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
        {/* Breadcrumb navigation */}
        <nav className="mb-6 text-sm text-clinical-text-muted">
          <button onClick={() => router.push('/dashboard')} className="hover:text-clinical-accent">
            Dashboard
          </button>
          <span className="mx-2">/</span>
          <button onClick={() => router.push(`/patient/${patientId}`)} className="hover:text-clinical-accent">
            {patient.name}
          </button>
          <span className="mx-2">/</span>
          <span className="text-clinical-text-primary">Risk Assessment</span>
        </nav>

        {/* Start button */}
        {phase === 'idle' && (
          <div className="mb-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-clinical-border bg-white py-16">
            <h2 className="mb-2 text-xl font-bold text-clinical-text-primary">
              PreOp Risk Assessment
            </h2>
            <p className="mb-6 max-w-md text-center text-sm text-clinical-text-muted">
              Multi-agent AI analysis using RCRI, ARISCAT, and metabolic risk scoring.
              Results are written as FHIR R4 resources to the patient chart.
            </p>
            <button
              onClick={startDemo}
              className="rounded-xl bg-clinical-accent px-10 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-clinical-accent-dark hover:shadow-xl"
            >
              Start Assessment
            </button>
          </div>
        )}

        {/* Agent panel + Gauges row */}
        {phase !== 'idle' && (
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <AgentStatusPanel agents={agents} />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
              <RiskGauge
                label="Cardiac Risk (RCRI)"
                score={showResults ? result.rcri.score : 0}
                maxScore={6}
                riskPercent={showResults ? result.rcri.riskPercent : 0}
                riskCategory={showResults ? result.rcri.riskCategory : '--'}
                detail="Lee 1999 — 6 binary criteria"
              />
              <RiskGauge
                label="Pulmonary Risk (ARISCAT)"
                score={showResults ? result.ariscat.score : 0}
                maxScore={123}
                riskPercent={showResults ? parseFloat(result.ariscat.ppcRisk) : 0}
                riskCategory={showResults ? result.ariscat.riskCategory : '--'}
                detail="Canet 2010 — 7 weighted factors"
              />
            </div>
          </div>
        )}

        {/* Results section */}
        {showResults && (
          <div className="space-y-6">
            <RiskBanner
              overallRisk={result.overallRisk}
              overallRiskPercent={result.overallRiskPercent}
              clinicalNarrative={result.clinicalNarrative}
              safeToProceed={result.safeToProceed}
              optimizationRequired={result.optimizationRequired}
              urgentConcerns={result.urgentConcerns}
            />

            {/* Metabolic indicators */}
            <MetabolicCards
              hba1c={DEMO_DATA.metabolic.hba1c}
              egfr={DEMO_DATA.metabolic.egfr}
              bmi={DEMO_DATA.metabolic.bmi}
              creatinine={DEMO_DATA.metabolic.creatinine}
            />

            <RecommendationsTable recommendations={result.recommendations} />

            <FhirResourceViewer resources={fhirResources} />

            {/* Re-run button */}
            <div className="flex justify-center pt-4 pb-8">
              <button
                onClick={startDemo}
                className="rounded-lg border border-clinical-border px-6 py-2 text-sm font-medium text-clinical-text-muted transition-colors hover:bg-slate-50"
              >
                Re-run Assessment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
