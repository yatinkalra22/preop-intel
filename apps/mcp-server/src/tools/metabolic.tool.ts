import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FhirClient } from '../fhir/client.js';
import { LOINC, METABOLIC_THRESHOLDS } from '@preop-intel/shared';

/**
 * get_metabolic_risk_data
 * Reads: Observation (HbA1c, eGFR, BMI, Creatinine) — 4 parallel LOINC queries
 *
 * Why 4 parallel searches? Each lab is a separate Observation search by LOINC code.
 * All 4 are independent FHIR calls.
 */
export function registerMetabolicTool(server: McpServer) {
  server.tool(
    'get_metabolic_risk_data',
    'Retrieves HbA1c, eGFR, BMI, and creatinine from FHIR for metabolic risk assessment',
    {
      patientId: z.string(),
      fhirBaseUrl: z.string(),
      accessToken: z.string(),
    },
    async ({ patientId, fhirBaseUrl, accessToken }) => {
      const fhir = new FhirClient(fhirBaseUrl, accessToken);

      const [hba1c, egfr, bmi, creatinine] = await Promise.all([
        fhir.search('Observation', { patient: patientId, code: LOINC.HBA1C, _sort: '-date', _count: '1' }),
        fhir.search('Observation', { patient: patientId, code: LOINC.EGFR, _sort: '-date', _count: '1' }),
        fhir.search('Observation', { patient: patientId, code: LOINC.BMI, _sort: '-date', _count: '1' }),
        fhir.search('Observation', { patient: patientId, code: LOINC.CREATININE, _sort: '-date', _count: '1' }),
      ]);

      const getValue = (bundle: any): number | null =>
        bundle.entry?.[0]?.resource?.valueQuantity?.value ?? null;

      const hba1cValue = getValue(hba1c);
      const egfrValue = getValue(egfr);
      const bmiValue = getValue(bmi);
      const creatinineValue = getValue(creatinine);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            hba1c: {
              value: hba1cValue,
              unit: '%',
              riskFlag: hba1cValue !== null && hba1cValue > METABOLIC_THRESHOLDS.HBA1C_UNSAFE,
            },
            egfr: {
              value: egfrValue,
              unit: 'mL/min/1.73m2',
              riskFlag: egfrValue !== null && egfrValue < METABOLIC_THRESHOLDS.EGFR_SEVERE,
            },
            bmi: {
              value: bmiValue,
              unit: 'kg/m2',
              riskFlag: bmiValue !== null && (bmiValue > METABOLIC_THRESHOLDS.BMI_MORBID_OBESITY || bmiValue < METABOLIC_THRESHOLDS.BMI_UNDERWEIGHT),
            },
            creatinine: {
              value: creatinineValue,
              unit: 'mg/dL',
              riskFlag: creatinineValue !== null && creatinineValue > METABOLIC_THRESHOLDS.CREATININE_HIGH,
            },
          }),
        }],
      };
    },
  );
}
