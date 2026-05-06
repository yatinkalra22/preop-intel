import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FhirClient } from '../fhir/client.js';
import { RiskAssessmentBuilder } from '../builders/risk-assessment.builder.js';
import { CarePlanBuilder } from '../builders/care-plan.builder.js';
import { SNOMED_SPECIALTIES, buildSharpExtensions, type SharpContext } from '@preop-intel/shared';

// Zod schema for the optional SHARP context that callers may attach to any
// write tool. Mirrors the SharpContext type in shared.
const sharpContextSchema = z.object({
  sourceAgent: z.string(),
  evidenceLinks: z.array(z.object({
    documentReference: z.string(),
    snippet: z.string(),
    findingId: z.string().optional(),
    category: z.string().optional(),
    severity: z.string().optional(),
  })).optional(),
  confidence: z.number().min(0).max(1).optional(),
}).optional();

// ─── FHIR Write Tools ────────────────────────────────────────────────────────
// These 4 tools are PreOp Intel's key innovation — AI-to-FHIR write-back.
// No competitor (NSQIP, Caresyntax, Epic) writes structured RiskAssessment
// resources back to the patient chart.
// Source: https://www.hl7.org/fhir/R4/riskassessment.html

export function registerWriteTools(server: McpServer) {

  // ─── create_risk_assessment ──────────────────────────────────────────────
  server.tool(
    'create_risk_assessment',
    'Writes a structured FHIR RiskAssessment resource to the patient chart',
    {
      patientId: z.string(),
      rcriScore: z.number(),
      rcriRiskPercent: z.number(),
      ariscatScore: z.number(),
      overallRisk: z.enum(['Low', 'Moderate', 'High', 'Very High']),
      overallRiskPercent: z.number(),
      clinicalNarrative: z.string(),
      recommendations: z.array(z.object({
        action: z.string(),
        urgency: z.string(),
        rationale: z.string(),
      })),
      fhirBaseUrl: z.string(),
      accessToken: z.string(),
      plannedProcedure: z.string(),
      sharpContext: sharpContextSchema,
    },
    async (input) => {
      const fhir = new FhirClient(input.fhirBaseUrl, input.accessToken);
      const resource = RiskAssessmentBuilder.build({
        ...input,
        sharpContext: input.sharpContext as SharpContext | undefined,
      });
      const created = await fhir.create('RiskAssessment', resource);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            id: created.id,
            status: 'created',
            resourceType: 'RiskAssessment',
          }),
        }],
      };
    },
  );

  // ─── create_care_plan ────────────────────────────────────────────────────
  // Flow: Create Goals first → get server-assigned IDs → create CarePlan
  // with Goal references. Why? FHIR requires Goal as a separate resource.
  // Source: https://www.hl7.org/fhir/R4/careplan.html#CarePlan.goal
  server.tool(
    'create_care_plan',
    'Writes a pre-operative optimization CarePlan with Goals to the patient chart',
    {
      patientId: z.string(),
      goals: z.array(z.object({
        description: z.string(),
        target: z.string(),
        timeframe: z.string(),
      })),
      activities: z.array(z.string()),
      fhirBaseUrl: z.string(),
      accessToken: z.string(),
      sharpContext: sharpContextSchema,
    },
    async (input) => {
      const fhir = new FhirClient(input.fhirBaseUrl, input.accessToken);
      const { carePlan, goals } = CarePlanBuilder.build({
        ...input,
        sharpContext: input.sharpContext as SharpContext | undefined,
      });

      // Create goals first, then reference them in the care plan
      const createdGoals = await Promise.all(
        goals.map(g => fhir.create('Goal', g)),
      );
      carePlan.goal = createdGoals.map(g => ({ reference: `Goal/${g.id}` }));
      const createdCarePlan = await fhir.create('CarePlan', carePlan);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            carePlanId: createdCarePlan.id,
            goalIds: createdGoals.map(g => g.id),
          }),
        }],
      };
    },
  );

  // ─── create_flag ─────────────────────────────────────────────────────────
  // Creates a high-risk Flag visible to the entire care team.
  // Uses FHIR flag-category "safety" code.
  server.tool(
    'create_flag',
    'Creates a high-risk Flag on the patient record visible to the care team',
    {
      patientId: z.string(),
      riskLevel: z.enum(['High', 'Very High']),
      summary: z.string(),
      fhirBaseUrl: z.string(),
      accessToken: z.string(),
      sharpContext: sharpContextSchema,
    },
    async ({ patientId, riskLevel, summary, fhirBaseUrl, accessToken, sharpContext }) => {
      const fhir = new FhirClient(fhirBaseUrl, accessToken);
      const sharpExt = buildSharpExtensions(sharpContext as SharpContext | undefined);
      const flag = {
        resourceType: 'Flag',
        status: 'active',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/flag-category',
            code: 'safety',
            display: 'Safety',
          }],
        }],
        code: { text: `${riskLevel} Perioperative Risk: ${summary}` },
        subject: { reference: `Patient/${patientId}` },
        ...(sharpExt.length > 0 ? { extension: sharpExt } : {}),
      };
      const created = await fhir.create('Flag', flag);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ id: created.id, status: 'created', resourceType: 'Flag' }),
        }],
      };
    },
  );

  // ─── create_service_request ──────────────────────────────────────────────
  // Creates specialist referral ServiceRequests.
  // SNOMED codes per specialty verified at https://browser.ihtsdotools.org/
  server.tool(
    'create_service_request',
    'Creates a specialist referral ServiceRequest (cardiology, endocrinology, pulmonology, nephrology)',
    {
      patientId: z.string(),
      specialty: z.enum(['cardiology', 'endocrinology', 'pulmonology', 'nephrology']),
      indication: z.string(),
      urgency: z.enum(['routine', 'urgent', 'asap', 'stat']),
      fhirBaseUrl: z.string(),
      accessToken: z.string(),
      sharpContext: sharpContextSchema,
    },
    async ({ patientId, specialty, indication, urgency, fhirBaseUrl, accessToken, sharpContext }) => {
      const fhir = new FhirClient(fhirBaseUrl, accessToken);
      const snomed = SNOMED_SPECIALTIES[specialty];
      const sharpExt = buildSharpExtensions(sharpContext as SharpContext | undefined);

      const serviceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        priority: urgency,
        code: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: snomed.code,
            display: snomed.display,
          }],
        },
        subject: { reference: `Patient/${patientId}` },
        reasonCode: [{ text: indication }],
        note: [{
          text: `Pre-operative consultation requested by PreOp Intel AI system. Indication: ${indication}`,
        }],
        ...(sharpExt.length > 0 ? { extension: sharpExt } : {}),
      };
      const created = await fhir.create('ServiceRequest', serviceRequest);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ id: created.id, status: 'created', resourceType: 'ServiceRequest' }),
        }],
      };
    },
  );
}
