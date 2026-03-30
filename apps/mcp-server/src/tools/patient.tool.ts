import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FhirClient } from '../fhir/client.js';

/**
 * get_patient_surgical_data
 * Reads: Patient, Procedure
 * Why parallel Promise.all? Patient read and Procedure search are independent
 * FHIR calls. Parallel saves ~200ms per call.
 */
export function registerPatientTool(server: McpServer) {
  server.tool(
    'get_patient_surgical_data',
    'Retrieves patient demographics and surgical history from FHIR',
    {
      patientId: z.string().describe('FHIR Patient resource ID'),
      fhirBaseUrl: z.string().describe('FHIR server base URL'),
      accessToken: z.string().describe('SMART on FHIR access token'),
    },
    async ({ patientId, fhirBaseUrl, accessToken }) => {
      const fhir = new FhirClient(fhirBaseUrl, accessToken);

      const [patient, procedures] = await Promise.all([
        fhir.read('Patient', patientId),
        fhir.search('Procedure', { patient: patientId, _count: '20', _sort: '-date' }),
      ]);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            patient: {
              id: patient.id,
              name: patient.name?.[0]?.text,
              birthDate: patient.birthDate,
              gender: patient.gender,
            },
            surgicalHistory: procedures.entry?.map((e: any) => ({
              code: e.resource.code?.coding?.[0]?.display,
              date: e.resource.performedDateTime,
              status: e.resource.status,
            })) ?? [],
          }),
        }],
      };
    },
  );
}
