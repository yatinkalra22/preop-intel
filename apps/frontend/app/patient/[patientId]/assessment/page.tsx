// Assessment page — the core demo screen.
// Flow: Click "Start Assessment" → agents animate → gauges fill → risk banner
// appears → recommendations table → FHIR resources shown. ~15-30 seconds.
//
// In demo mode, we simulate the SSE stream with timed state transitions.
// In production, this would use EventSource to /api/assessments/:id/stream.

'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DEMO_PATIENT, DEMO_DATA, DEMO_FHIR_RESOURCES } from '@preop-intel/shared';
import type { AgentName, AgentStatus, AgentStatusUpdate, AssessmentResult } from '@preop-intel/shared';
import { PatientBanner } from '@/components/layout/PatientBanner';
import { AgentStatusPanel } from '@/components/agents/AgentStatusPanel';
import { RiskGauge } from '@/components/risk/RiskGauge';
import { RiskBanner } from '@/components/risk/RiskBanner';
import { MetabolicCards } from '@/components/risk/MetabolicCards';
import { RecommendationsTable } from '@/components/risk/RecommendationsTable';
import { FhirResourceViewer } from '@/components/fhir/FhirResourceViewer';
import { api } from '@/lib/api';
import { usePreOpStore } from '@/lib/store';

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

const DEMO_ASSESSMENT_RESULT: AssessmentResult = {
  id: 'demo-assessment',
  patientId: DEMO_PATIENT.id,
  overallRisk: DEMO_DATA.assessmentResult.overallRisk,
  overallRiskPercent: DEMO_DATA.assessmentResult.overallRiskPercent,
  clinicalNarrative: DEMO_DATA.assessmentResult.clinicalNarrative,
  safeToProceed: DEMO_DATA.assessmentResult.safeToProceed,
  optimizationRequired: DEMO_DATA.assessmentResult.optimizationRequired,
  urgentConcerns: DEMO_DATA.assessmentResult.urgentConcerns,
  recommendations: DEMO_DATA.assessmentResult.recommendations,
  rcri: {
    score: DEMO_DATA.assessmentResult.rcri.score,
    criteria: DEMO_DATA.cardiac,
    riskPercent: DEMO_DATA.assessmentResult.rcri.riskPercent,
    riskCategory: DEMO_DATA.assessmentResult.rcri.riskCategory,
    interpretation: 'Moderate perioperative cardiac risk based on RCRI score',
  },
  ariscat: {
    score: DEMO_DATA.assessmentResult.ariscat.score,
    riskCategory: DEMO_DATA.assessmentResult.ariscat.riskCategory,
    ppcRisk: DEMO_DATA.assessmentResult.ariscat.ppcRisk,
    recommendations: [],
  },
  metabolicRisk: DEMO_DATA.metabolic,
  medicationRisk: DEMO_DATA.medication,
  fhirWriteResults: {},
};

export default function AssessmentPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const patient = DEMO_PATIENT;
  const isDemoMode = usePreOpStore((s) => s.isDemoMode);
  const fhirToken = usePreOpStore((s) => s.fhirToken);
  const fhirBaseUrl = usePreOpStore((s) => s.fhirBaseUrl);

  const [result, setResult] = useState<AssessmentResult | null>(null);

  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS);
  const [phase, setPhase] = useState<'idle' | 'running' | 'complete'>('idle');
  const [showResults, setShowResults] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const currentResult = result ?? DEMO_ASSESSMENT_RESULT;

  const allComplete = useMemo(
    () => agents.every((a) => a.status === 'complete'),
    [agents],
  );

  const cleanupRuntime = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const fetchFinalResult = useCallback(async (id: string) => {
    try {
      const session = await api.getAssessment(id);
      if (session.status === 'completed') {
        setResult(session.assessmentResult ?? DEMO_ASSESSMENT_RESULT);
        setPhase('complete');
        setShowResults(true);
        return true;
      }
      if (session.status === 'failed') {
        setError('Assessment failed to complete. Showing fallback demo results.');
        setResult(DEMO_ASSESSMENT_RESULT);
        setPhase('complete');
        setShowResults(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const connectToStream = useCallback((id: string) => {
    const source = new EventSource(api.getStreamUrl(id));
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data) as AgentStatusUpdate;
        setAgents((prev) =>
          prev.map((a) =>
            a.name === update.agentName
              ? {
                  ...a,
                  status: update.status,
                  durationMs: update.durationMs ?? a.durationMs,
                }
              : a,
          ),
        );

        if (update.status === 'error') {
          setError(update.error ?? 'One of the specialist agents failed.');
        }
      } catch {
        // Ignore malformed SSE messages.
      }
    };

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, []);

  const runLocalFallbackDemo = useCallback(() => {
    setAgents(INITIAL_AGENTS);
    setPhase('running');
    setShowResults(false);
    setResult(null);
    setError('Backend unavailable. Running local demo simulation.');

    cleanupRuntime();

    for (const step of DEMO_TIMELINE) {
      const t = setTimeout(() => {
        setAgents((prev) =>
          prev.map((a) =>
            step.agents.includes(a.name)
              ? { ...a, status: step.action, durationMs: step.durationMs ?? a.durationMs }
              : a,
          ),
        );
      }, step.delay);
      timeoutsRef.current.push(t);
    }

    const t = setTimeout(() => {
      setResult(DEMO_ASSESSMENT_RESULT);
      setPhase('complete');
      setShowResults(true);
    }, 5500);
    timeoutsRef.current.push(t);
  }, [cleanupRuntime]);

  const startDemo = useCallback(() => {
    const run = async () => {
      cleanupRuntime();

      setAgents(INITIAL_AGENTS);
      setPhase('running');
      setShowResults(false);
      setResult(null);
      setError(null);

      try {
        const payload = {
          patientId,
          fhirBaseUrl: fhirBaseUrl ?? 'demo',
          accessToken: fhirToken ?? 'demo-token',
          plannedProcedure: patient.plannedProcedure,
        };

        const { id } = await api.startAssessment(payload);
        setAssessmentId(id);
        connectToStream(id);

        pollingRef.current = setInterval(async () => {
          const done = await fetchFinalResult(id);
          if (done && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
          }
        }, 1200);
      } catch {
        runLocalFallbackDemo();
      }
    };

    void run();
  }, [cleanupRuntime, connectToStream, fetchFinalResult, fhirBaseUrl, fhirToken, patient.plannedProcedure, patientId, runLocalFallbackDemo]);

  useEffect(() => {
    if (phase === 'running' && allComplete && assessmentId) {
      void fetchFinalResult(assessmentId);
    }
  }, [allComplete, assessmentId, fetchFinalResult, phase]);

  useEffect(() => {
    return () => {
      cleanupRuntime();
    };
  }, [cleanupRuntime]);

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

      <div className="mx-auto max-w-7xl px-6 py-8 fade-rise">
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
          <div className="glass-panel mb-8 flex flex-col items-center justify-center rounded-2xl border border-cyan-100 py-16 shadow-sm">
            <p className="mb-3 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Multi-agent orchestration
            </p>
            <h2 className="mb-2 text-xl font-bold text-clinical-text-primary">
              PreOp Risk Assessment
            </h2>
            <p className="mb-6 max-w-md text-center text-sm text-clinical-text-muted">
              Multi-agent AI analysis using RCRI, ARISCAT, and metabolic risk scoring.
              Results are written as FHIR R4 resources to the patient chart.
            </p>
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-clinical-text-muted">
              Mode: {isDemoMode || !fhirToken ? 'Demo' : 'SMART on FHIR Live'}
            </p>
            <button
              onClick={startDemo}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 px-10 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-xl"
            >
              Start Assessment
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        )}

        {/* Agent panel + Gauges row */}
        {phase !== 'idle' && (
          <div className="mb-6 grid gap-6 lg:grid-cols-3 stagger-in">
            <div className="lg:col-span-1">
              <AgentStatusPanel agents={agents} />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
              <RiskGauge
                label="Cardiac Risk (RCRI)"
                score={showResults ? currentResult.rcri.score : 0}
                maxScore={6}
                riskPercent={showResults ? currentResult.rcri.riskPercent : 0}
                riskCategory={showResults ? currentResult.rcri.riskCategory : '--'}
                detail="Lee 1999 — 6 binary criteria"
              />
              <RiskGauge
                label="Pulmonary Risk (ARISCAT)"
                score={showResults ? currentResult.ariscat.score : 0}
                maxScore={123}
                riskPercent={showResults ? parseFloat(currentResult.ariscat.ppcRisk) : 0}
                riskCategory={showResults ? currentResult.ariscat.riskCategory : '--'}
                detail="Canet 2010 — 7 weighted factors"
              />
            </div>
          </div>
        )}

        {/* Results section */}
        {showResults && (
          <div className="space-y-6 fade-rise">
            <RiskBanner
              overallRisk={currentResult.overallRisk}
              overallRiskPercent={currentResult.overallRiskPercent}
              clinicalNarrative={currentResult.clinicalNarrative}
              safeToProceed={currentResult.safeToProceed}
              optimizationRequired={currentResult.optimizationRequired}
              urgentConcerns={currentResult.urgentConcerns}
            />

            {/* Metabolic indicators */}
            <MetabolicCards
              hba1c={currentResult.metabolicRisk?.hba1c ?? DEMO_DATA.metabolic.hba1c}
              egfr={currentResult.metabolicRisk?.egfr ?? DEMO_DATA.metabolic.egfr}
              bmi={currentResult.metabolicRisk?.bmi ?? DEMO_DATA.metabolic.bmi}
              creatinine={currentResult.metabolicRisk?.creatinine ?? DEMO_DATA.metabolic.creatinine}
            />

            <RecommendationsTable recommendations={currentResult.recommendations} />

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
