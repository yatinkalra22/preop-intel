import type { FhirRiskAssessment } from '@preop-intel/shared';
import { SNOMED_RISK_ASSESSMENT } from '@preop-intel/shared';

// Builds a FHIR R4 RiskAssessment resource from assessment results.
// Why a builder? Encapsulates SNOMED codes, FHIR coding systems, and resource
// structure. Keeps MCP tool handlers clean and makes unit testing possible
// without the MCP server.
// Source: https://www.hl7.org/fhir/R4/riskassessment.html

export interface RiskAssessmentInput {
  patientId: string;
  rcriScore: number;
  rcriRiskPercent: number;
  ariscatScore: number;
  overallRisk: string;
  overallRiskPercent: number;
  clinicalNarrative: string;
  recommendations: Array<{ action: string; urgency: string; rationale: string }>;
  plannedProcedure: string;
}

export class RiskAssessmentBuilder {
  static build(input: RiskAssessmentInput): FhirRiskAssessment {
    return {
      resourceType: 'RiskAssessment',
      status: 'final',
      subject: { reference: `Patient/${input.patientId}` },
      occurrenceDateTime: new Date().toISOString(),
      basis: [
        { display: `RCRI Score: ${input.rcriScore}/6` },
        { display: `ARISCAT Score: ${input.ariscatScore}` },
      ],
      prediction: [
        {
          outcome: { text: 'Major Adverse Cardiac Events (MACE)' },
          probabilityDecimal: input.rcriRiskPercent / 100,
          qualitativeRisk: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/risk-probability',
              code: mapRiskToCode(input.overallRisk),
              display: input.overallRisk,
            }],
          },
          whenPeriod: { start: new Date().toISOString() },
        },
      ],
      note: [
        { text: input.clinicalNarrative },
        ...input.recommendations.map(r => ({
          text: `[${r.urgency.toUpperCase()}] ${r.action} — ${r.rationale}`,
        })),
      ],
      code: {
        coding: [{
          system: SNOMED_RISK_ASSESSMENT.system,
          code: SNOMED_RISK_ASSESSMENT.code,
          display: SNOMED_RISK_ASSESSMENT.display,
        }],
      },
      extension: [{
        url: 'http://preop-intel.ai/fhir/StructureDefinition/planned-procedure',
        valueString: input.plannedProcedure,
      }],
    };
  }
}

function mapRiskToCode(risk: string): string {
  const map: Record<string, string> = {
    'Low': 'low',
    'Moderate': 'moderate',
    'High': 'high',
    'Very High': 'high',
  };
  return map[risk] ?? 'moderate';
}
