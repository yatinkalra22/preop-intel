import type { SynthesisInput } from '../ai.service';

export function buildOrchestratorPrompt(params: SynthesisInput): string {
  const age = params.patient.birthDate
    ? new Date().getFullYear() - new Date(params.patient.birthDate).getFullYear()
    : 'Unknown';

  return `
PATIENT SURGICAL RISK ASSESSMENT

Patient: ${params.patient.name?.[0]?.text ?? params.patient.name ?? 'Unknown'}, Age: ${age}
Planned Procedure: ${params.plannedProcedure}

CARDIAC RISK (RCRI):
Score: ${params.rcri.score}/6 — ${params.rcri.riskCategory} (${params.rcri.riskPercent}% MACE risk)
Active criteria: ${JSON.stringify(params.rcri.criteria, null, 2)}

PULMONARY RISK (ARISCAT):
Score: ${params.ariscat.score} — ${params.ariscat.riskCategory} (${params.ariscat.ppcRisk} PPC risk)
Recommendations: ${params.ariscat.recommendations.join('; ')}

METABOLIC RISK:
${JSON.stringify(params.metabolicRisk, null, 2)}

MEDICATION RISK:
${JSON.stringify(params.medicationRisk, null, 2)}

Synthesize into JSON:
{
  "overallRisk": "Low|Moderate|High|Very High",
  "overallRiskPercent": number,
  "clinicalNarrative": "2-3 sentence summary",
  "urgentConcerns": ["..."],
  "recommendations": [{ "action": "...", "urgency": "Immediate|Within 2 weeks|Before surgery", "rationale": "..." }],
  "safeToProceed": boolean,
  "optimizationRequired": boolean
}
`;
}
