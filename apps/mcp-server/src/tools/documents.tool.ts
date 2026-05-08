import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FhirClient } from '../fhir/client.js';
import { resolveFhirContext } from '../fhir/context.js';
import type { ClinicalDocument } from '@preop-intel/shared';

const DOCUMENT_TYPE_LOINC: Record<string, string> = {
  'H&P': '11506-3',
  consult: '34758-6',
  discharge: '18842-5',
  operative: '11504-8',
};

export function registerDocumentsTool(server: McpServer) {
  server.tool(
    'get_clinical_documents',
    'Retrieves clinical notes (DocumentReference + Binary content) for a patient. Returns text + metadata for each document so an extractor agent can derive findings.',
    {
      patientId: z.string().describe('FHIR Patient resource ID').optional(),
      fhirBaseUrl: z.string().describe('FHIR server base URL').optional(),
      accessToken: z.string().describe('SMART on FHIR access token').optional(),
      types: z.array(z.enum(['H&P', 'consult', 'discharge', 'operative']))
        .optional()
        .describe('Filter to specific document types (LOINC). Omit for all types.'),
      limit: z.number().int().min(1).max(50).default(20).describe('Max documents returned'),
    },
    async ({ types, limit, ...rest }) => {
      const { patientId, fhirBaseUrl, accessToken } = resolveFhirContext(rest);
      const fhir = new FhirClient(fhirBaseUrl, accessToken);

      const searchParams: Record<string, string> = {
        patient: patientId,
        status: 'current',
        _count: String(limit),
        _sort: '-date',
      };
      if (types && types.length > 0) {
        searchParams.type = types
          .map(t => `http://loinc.org|${DOCUMENT_TYPE_LOINC[t]}`)
          .join(',');
      }

      const bundle = await fhir.search('DocumentReference', searchParams);
      const entries = bundle.entry ?? [];

      const documents: ClinicalDocument[] = await Promise.all(
        entries.map(async (entry: any) => extractDocument(entry.resource, fhir)),
      );

      const filtered = documents.filter(d => d.text.trim().length > 0);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            documents: filtered,
            documentCount: filtered.length,
          }),
        }],
      };
    },
  );
}

async function extractDocument(resource: any, fhir: FhirClient): Promise<ClinicalDocument> {
  const attachment = resource.content?.[0]?.attachment ?? {};

  let text = '';
  if (attachment.data) {
    text = decodeBase64(attachment.data);
  } else if (attachment.url) {
    text = await fetchAttachmentText(attachment.url, fhir);
  }

  const typeCoding = resource.type?.coding?.[0];
  const author = resource.author?.[0]?.display
    ?? resource.author?.[0]?.reference
    ?? undefined;
  const sourceOrg = resource.custodian?.display
    ?? resource.custodian?.reference
    ?? undefined;

  return {
    id: resource.id,
    type: typeCoding?.display ?? resource.type?.text ?? 'Unknown',
    typeCode: typeCoding?.code,
    date: resource.date ?? resource.meta?.lastUpdated ?? new Date(0).toISOString(),
    author,
    sourceOrg,
    text,
  };
}

function decodeBase64(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf-8');
}

async function fetchAttachmentText(url: string, fhir: FhirClient): Promise<string> {
  const binaryRefMatch = url.match(/Binary\/([^/?]+)$/);
  if (binaryRefMatch) {
    const binary = await fhir.read('Binary', binaryRefMatch[1]);
    if (binary.data) return decodeBase64(binary.data);
    if (binary.contentType?.startsWith('text/') && typeof binary === 'string') {
      return binary;
    }
    return '';
  }
  return '';
}
