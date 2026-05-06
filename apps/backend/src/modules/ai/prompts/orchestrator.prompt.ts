import type { SynthesisInput } from '../ai.service';

export function buildOrchestratorPrompt(params: SynthesisInput): string {
  const age = params.patient.birthDate
    ? new Date().getFullYear() - new Date(params.patient.birthDate).getFullYear()
    : 'Unknown';

  const findingsBlock = params.findings && params.findings.length > 0
    ? `\nFINDINGS EXTRACTED FROM CLINICAL NOTES (verbatim citations verified):
${params.findings.map(f =>
  `- [${f.severity.toUpperCase()} | ${f.category} | confidence ${f.confidence.toFixed(2)} | display=${f.displayState}] ${f.finding}
   source: ${f.sourceDocumentId} — "${f.sourceSnippet}"
   implication: ${f.riskImplication}${f.guidelineRef ? `\n   guideline: ${f.guidelineRef}` : ''}`,
).join('\n')}\n`
    : '';

  const alertsBlock = params.criticalAlerts && params.criticalAlerts.length > 0
    ? `\nCRITICAL ALERTS FROM SPECIALIST AGENTS (these often outweigh raw RCRI/ARISCAT scores):
${params.criticalAlerts.map(a => `- ${a}`).join('\n')}\n`
    : '';

  const overridesBlock = params.overrides && params.overrides.length > 0
    ? `\nSTRUCTURED-DATA OVERRIDES (note findings post-dated structured data):
${params.overrides.map(o => `- ${o.field}: ${JSON.stringify(o.structuredValue)} → ${JSON.stringify(o.noteValue)} (${o.reason})`).join('\n')}\n`
    : '';

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
${findingsBlock}${alertsBlock}${overridesBlock}
SYNTHESIS RULES:
- A single CRITICAL severity finding (e.g. recent MI within 60 days) overrides RCRI/ARISCAT and pushes overall risk to "Very High" with safeToProceed=false.
- Pending-confirmation medication findings must NOT auto-defer surgery, but should appear in urgentConcerns with explicit clinician confirmation language.
- If overrides modified RCRI/ARISCAT inputs, reflect this in clinicalNarrative ("AI extracted from H&P note that...").
- Cite specific guidelines when present in the findings.

Synthesize into JSON:
{
  "overallRisk": "Low|Moderate|High|Very High",
  "overallRiskPercent": number,
  "clinicalNarrative": "2-4 sentence summary that names key findings",
  "urgentConcerns": ["..."],
  "recommendations": [{ "action": "...", "urgency": "Immediate|Within 2 weeks|Before surgery", "rationale": "..." }],
  "safeToProceed": boolean,
  "optimizationRequired": boolean
}
`;
}
