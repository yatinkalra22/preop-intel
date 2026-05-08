// A2A AgentExecutor for the PreOp Intel orchestrator.
//
// This executor runs deterministic risk computation. It does NOT call an LLM.
// The upstream Po BYO agent (configured with the prompts in docs/po-agents/)
// is the LLM-driven layer; it prepares structured inputs + extracted findings
// and calls into us. We return the canonical risk artifact.
//
// Wire contract: the user message carries either
//   (a) a DataPart with a JSON body, or
//   (b) a TextPart whose text is JSON (parsed eagerly).
// Body shape (Zod-validated):
//   {
//     plannedProcedure: string,
//     daysToSurgery?: number (default 7),
//     surgeryType?: string,
//     rcri: RcriInput,
//     ariscat: AriscatInput,
//     metabolic: MetabolicRiskData,
//     findings?: ClinicalFinding[],
//   }
//
// FHIR context (fhirUrl/fhirToken/patientId) is read from message metadata.
// It is forwarded into the artifact so a downstream MCP write-back tool can
// use it; the executor itself does not call the FHIR server.

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import type {
  AriscatInput,
  ClinicalFinding,
  FindingCategory,
  FindingSeverity,
  MetabolicRiskData,
  RcriInput,
} from '@preop-intel/shared';
import { RiskService } from '../modules/risk/risk.service';
import {
  applyFindingsToCardiac,
  applyFindingsToPulmonary,
  applyFindingsToMetabolic,
} from '../modules/agents/findings-application';
import {
  computeCancellationScore,
  computeCostBand,
  derivePreventableIssues,
} from '../modules/risk/cancellation.service';
import { extractFhirContext } from './fhir-context';

const RcriInputSchema: z.ZodType<RcriInput> = z.object({
  highRiskSurgery: z.boolean(),
  ischemicHeartDisease: z.boolean(),
  heartFailureHistory: z.boolean(),
  cerebrovascularDisease: z.boolean(),
  diabetesOnInsulin: z.boolean(),
  creatinineAbove2: z.boolean(),
});

const AriscatInputSchema: z.ZodType<AriscatInput> = z.object({
  age: z.number(),
  spo2Preop: z.number(),
  respiratoryInfectionLastMonth: z.boolean(),
  preopHemoglobin: z.number(),
  surgicalIncisionSite: z.enum(['peripheral', 'upper_abdominal', 'intrathoracic']),
  surgeryDurationHours: z.number(),
  emergencySurgery: z.boolean(),
});

const MetabolicValueSchema = z.object({
  value: z.number().nullable(),
  unit: z.string(),
  riskFlag: z.boolean(),
});

const MetabolicSchema: z.ZodType<MetabolicRiskData> = z.object({
  hba1c: MetabolicValueSchema,
  egfr: MetabolicValueSchema,
  bmi: MetabolicValueSchema,
  creatinine: MetabolicValueSchema,
});

const FindingSchema = z.object({
  id: z.string(),
  finding: z.string(),
  category: z.enum(['medication', 'functional', 'cardiac-event', 'respiratory', 'metabolic', 'other']) as z.ZodType<FindingCategory>,
  riskImplication: z.string(),
  guidelineRef: z.string().optional(),
  sourceDocumentId: z.string(),
  sourceSnippet: z.string(),
  confidence: z.number(),
  severity: z.enum(['low', 'moderate', 'high', 'critical']) as z.ZodType<FindingSeverity>,
  displayState: z.enum(['detected', 'possible', 'pending-confirmation']),
  verifiedSnippet: z.boolean(),
}).passthrough() as z.ZodType<ClinicalFinding>;

const RequestSchema = z.object({
  plannedProcedure: z.string(),
  daysToSurgery: z.number().optional(),
  surgeryType: z.string().optional(),
  rcri: RcriInputSchema,
  ariscat: AriscatInputSchema,
  metabolic: MetabolicSchema,
  findings: z.array(FindingSchema).optional(),
});

export class PreOpRiskExecutor implements AgentExecutor {
  private readonly riskService = new RiskService();

  cancelTask = async (): Promise<void> => {
    /* no-op: requests are fast and synchronous */
  };

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { userMessage, contextId } = requestContext;

    try {
      const json = extractJsonBody(userMessage.parts);
      const parsed = RequestSchema.parse(json);

      const fhirContext = extractFhirContext(userMessage);
      const findings = parsed.findings ?? [];

      const rcri = this.riskService.calculateRcri(parsed.rcri);
      const ariscat = this.riskService.calculateAriscat(parsed.ariscat);

      const cardiac = applyFindingsToCardiac(parsed.rcri, findings);
      const pulmonary = applyFindingsToPulmonary(parsed.ariscat, findings);
      const metabolic = applyFindingsToMetabolic(parsed.metabolic, findings);

      const rcriAfterOverrides = this.riskService.calculateRcri(cardiac.adjustedInput);
      const ariscatAfterOverrides = this.riskService.calculateAriscat(pulmonary.adjustedInput);

      const cancellationInput = {
        findings,
        daysToSurgery: parsed.daysToSurgery ?? 7,
        surgeryType: parsed.surgeryType ?? 'default',
      };
      const { score: cancellationScore, severityCounts } = computeCancellationScore(cancellationInput);
      const { low: costLow, high: costHigh } = computeCostBand(cancellationInput);
      const preventableIssues = derivePreventableIssues(findings, cancellationInput.daysToSurgery);

      const artifact = {
        plannedProcedure: parsed.plannedProcedure,
        rcri: rcriAfterOverrides,
        ariscat: ariscatAfterOverrides,
        cardiac: { ...cardiac, baseline: rcri },
        pulmonary: { ...pulmonary, baseline: ariscat },
        metabolic,
        cancellation: {
          score: cancellationScore,
          estimatedCostAvoidanceLow: costLow,
          estimatedCostAvoidanceHigh: costHigh,
          severityCounts,
          preventableIssues,
        },
        findingsAppliedCount: findings.length,
        fhirContext: fhirContext
          ? { patientId: fhirContext.patientId, fhirUrl: fhirContext.fhirUrl }
          : null,
      };

      eventBus.publish({
        kind: 'message',
        messageId: randomUUID(),
        role: 'agent',
        parts: [
          {
            kind: 'data',
            data: artifact as unknown as Record<string, unknown>,
          },
          {
            kind: 'text',
            text: JSON.stringify(artifact, null, 2),
          },
        ],
        contextId,
      });
    } catch (err) {
      const detail = err instanceof z.ZodError
        ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        : err instanceof Error
          ? err.message
          : String(err);

      eventBus.publish({
        kind: 'message',
        messageId: randomUUID(),
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text: `ERROR: ${detail}`,
          },
        ],
        contextId,
      });
    }

    eventBus.finished();
  }
}

function extractJsonBody(parts: unknown[]): unknown {
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const p = part as { kind?: string; data?: unknown; text?: string };
    if (p.kind === 'data' && p.data && typeof p.data === 'object') return p.data;
    if (p.kind === 'text' && typeof p.text === 'string' && p.text.trim().length > 0) {
      const trimmed = p.text.trim();
      try {
        return JSON.parse(trimmed);
      } catch {
        // ignore — try next part
      }
    }
  }
  throw new Error('Request body must be JSON in either a DataPart or a TextPart.');
}
