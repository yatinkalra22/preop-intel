import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FhirClient } from '../fhir/client.js';
import { LOINC, ICD10_RCRI } from '@preop-intel/shared';

/**
 * get_cardiac_risk_data
 * Reads: Condition (active), Observation (creatinine LOINC 2160-0)
 *
 * Why ICD-10 prefix matching? ICD-10 codes have subcategories (I25.1, I25.10).
 * Prefix matching captures all subcategories without an exhaustive list.
 */
export function registerCardiacTool(server: McpServer) {
  server.tool(
    'get_cardiac_risk_data',
    'Retrieves all FHIR data needed to calculate the Revised Cardiac Risk Index (RCRI)',
    {
      patientId: z.string(),
      fhirBaseUrl: z.string(),
      accessToken: z.string(),
    },
    async ({ patientId, fhirBaseUrl, accessToken }) => {
      const fhir = new FhirClient(fhirBaseUrl, accessToken);

      // Parallel FHIR queries — conditions and creatinine are independent
      const [conditions, creatinine] = await Promise.all([
        fhir.search('Condition', {
          patient: patientId,
          'clinical-status': 'active',
          _count: '100',
        }),
        fhir.search('Observation', {
          patient: patientId,
          code: LOINC.CREATININE,
          _sort: '-date',
          _count: '1',
        }),
      ]);

      const conditionCodes: string[] = conditions.entry?.map(
        (e: any) => e.resource.code?.coding?.[0]?.code,
      ).filter(Boolean) ?? [];

      const matchesAny = (codes: string[], prefixes: readonly string[]) =>
        codes.some(c => prefixes.some(p => c.startsWith(p)));

      const ischemicHeartDisease = matchesAny(conditionCodes, ICD10_RCRI.ISCHEMIC_HEART_DISEASE);
      const heartFailureHistory = matchesAny(conditionCodes, ICD10_RCRI.HEART_FAILURE);
      const cerebrovascularDisease = matchesAny(conditionCodes, ICD10_RCRI.CEREBROVASCULAR_DISEASE);
      const diabetesOnInsulin = matchesAny(conditionCodes, ICD10_RCRI.DIABETES);

      const creatinineObs = creatinine.entry?.[0]?.resource;
      const creatinineValue: number = creatinineObs?.valueQuantity?.value ?? 0;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            ischemicHeartDisease,
            heartFailureHistory,
            cerebrovascularDisease,
            diabetesOnInsulin, // Refined further by medication check in orchestrator
            creatinineAbove2: creatinineValue > 2.0,
            creatinineValue,
            conditionCodes,
          }),
        }],
      };
    },
  );
}
