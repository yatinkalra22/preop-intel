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

// Cap per-document text size we hand back to the caller. Real H&P notes are
// usually <50KB; OSH discharge bundles can include scanned-PDF base64 attachments
// that blow past 50MB and OOM the Lambda. Override with MCP_MAX_DOCUMENT_BYTES.
const DEFAULT_MAX_DOC_BYTES = 5 * 1024 * 1024; // 5MB

function maxDocBytes(): number {
  const v = Number(process.env.MCP_MAX_DOCUMENT_BYTES);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MAX_DOC_BYTES;
}

export function registerDocumentsTool(server: McpServer) {
  server.tool(
    'get_clinical_documents',
    'Retrieves clinical notes (DocumentReference + Binary content) for a patient. Returns text + metadata for each document so an extractor agent can derive findings. Documents larger than MCP_MAX_DOCUMENT_BYTES (default 5MB) are returned with metadata only and skipped="oversize".',
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
      const cap = maxDocBytes();

      const documents = await Promise.all(
        entries.map(async (entry: any) => extractDocument(entry.resource, fhir, cap)),
      );

      const kept = documents.filter(d => d.text.trim().length > 0 || d.skipped);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            documents: kept,
            documentCount: kept.length,
            skippedOversizeCount: kept.filter(d => d.skipped === 'oversize').length,
            maxDocumentBytes: cap,
          }),
        }],
      };
    },
  );
}

type ExtractedDocument = ClinicalDocument & { skipped?: 'oversize' };

async function extractDocument(resource: any, fhir: FhirClient, cap: number): Promise<ExtractedDocument> {
  const attachment = resource.content?.[0]?.attachment ?? {};

  // Skip via Attachment.size (FHIR-supplied) before fetching: free check.
  const declaredSize: number | undefined = typeof attachment.size === 'number' ? attachment.size : undefined;
  if (declaredSize !== undefined && declaredSize > cap) {
    return baseDoc(resource, '', 'oversize');
  }

  let text = '';
  if (attachment.data) {
    text = decodeBase64(attachment.data, cap);
  } else if (attachment.url) {
    text = await fetchAttachmentText(attachment.url, fhir, cap);
  }

  // Defensive byte-length check after decode (size header is advisory, not authoritative).
  if (Buffer.byteLength(text, 'utf-8') > cap) {
    return baseDoc(resource, '', 'oversize');
  }

  return baseDoc(resource, text);
}

function baseDoc(resource: any, text: string, skipped?: 'oversize'): ExtractedDocument {
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
    ...(skipped ? { skipped } : {}),
  };
}

function decodeBase64(b64: string, cap: number): string {
  // Cheap pre-check: base64 decoded length is ~len * 3/4. Skip the decode if
  // we know it'll bust the cap.
  if (b64.length > cap * 1.4) return '';
  return Buffer.from(b64, 'base64').toString('utf-8');
}

async function fetchAttachmentText(url: string, fhir: FhirClient, cap: number): Promise<string> {
  const binaryRefMatch = url.match(/Binary\/([^/?]+)$/);
  if (binaryRefMatch) {
    const binary = await fhir.read('Binary', binaryRefMatch[1]);
    if (binary.data) return decodeBase64(binary.data, cap);
    if (binary.contentType?.startsWith('text/') && typeof binary === 'string') {
      return binary;
    }
    return '';
  }
  return '';
}
