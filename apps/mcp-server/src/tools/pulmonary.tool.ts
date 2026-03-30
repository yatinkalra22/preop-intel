import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FhirClient } from '../fhir/client.js';
import { LOINC, ICD10_RESPIRATORY_INFECTION } from '@preop-intel/shared';

/**
 * get_pulmonary_risk_data
 * Reads: Observation (SpO2, Hemoglobin), Condition, Patient (for age)
 *
 * Why fetch Patient here too? ARISCAT requires age. Fetching it here makes the
 * tool self-contained — any agent can call it without pre-fetching Patient.
 */
export function registerPulmonaryTool(server: McpServer) {
  server.tool(
    'get_pulmonary_risk_data',
    'Retrieves FHIR data for ARISCAT pulmonary complication risk calculation',
    {
      patientId: z.string(),
      fhirBaseUrl: z.string(),
      accessToken: z.string(),
    },
    async ({ patientId, fhirBaseUrl, accessToken }) => {
      const fhir = new FhirClient(fhirBaseUrl, accessToken);

      // All 4 queries are independent — run in parallel
      const [spo2, hemoglobin, conditions, patient] = await Promise.all([
        fhir.search('Observation', {
          patient: patientId,
          code: LOINC.SPO2,
          _sort: '-date',
          _count: '1',
        }),
        fhir.search('Observation', {
          patient: patientId,
          code: LOINC.HEMOGLOBIN,
          _sort: '-date',
          _count: '1',
        }),
        fhir.search('Condition', {
          patient: patientId,
          'clinical-status': 'active',
          _count: '100',
        }),
        fhir.read('Patient', patientId),
      ]);

      const age = calculateAge(patient.birthDate);
      const spo2Value: number = spo2.entry?.[0]?.resource?.valueQuantity?.value ?? 98;
      const hemoglobinValue: number = hemoglobin.entry?.[0]?.resource?.valueQuantity?.value ?? 12;

      const conditionCodes: string[] = conditions.entry?.map(
        (e: any) => e.resource.code?.coding?.[0]?.code,
      ).filter(Boolean) ?? [];

      const hasRespiratoryInfection = conditionCodes.some(c =>
        ICD10_RESPIRATORY_INFECTION.some(icd => c.startsWith(icd)),
      );

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            age,
            spo2Value,
            hemoglobinValue,
            hasRespiratoryInfection,
          }),
        }],
      };
    },
  );
}

function calculateAge(birthDate: string | undefined): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
