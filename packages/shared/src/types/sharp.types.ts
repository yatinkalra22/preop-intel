// SHARP Extension Specs — healthcare context propagation.
//
// The hackathon brief calls for SHARP extensions on FHIR write-back resources
// so downstream systems can trace which agent produced an output, what evidence
// drove it, and the confidence behind it.
//
// URLs are placeholders that match the canonical SHARP extension spec; if the
// official URL stems differ, change them here in one place. Builders consume
// these via buildSharpExtensions().

export const SHARP_EXTENSION = {
  CONTEXT_SOURCE: 'http://sharp-spec.org/StructureDefinition/sharp-context-source',
  EVIDENCE_LINK: 'http://sharp-spec.org/StructureDefinition/sharp-evidence-link',
  CONFIDENCE:    'http://sharp-spec.org/StructureDefinition/sharp-confidence',
} as const;

export interface SharpEvidenceLink {
  documentReference: string;
  snippet: string;
  findingId?: string;
  category?: string;
  severity?: string;
}

export interface SharpContext {
  sourceAgent: string;
  evidenceLinks?: SharpEvidenceLink[];
  confidence?: number;
}

export interface FhirExtension {
  url: string;
  valueString?: string;
  valueDecimal?: number;
  valueReference?: { reference: string };
  extension?: FhirExtension[];
}

export function buildSharpExtensions(ctx?: SharpContext): FhirExtension[] {
  if (!ctx) return [];

  const out: FhirExtension[] = [
    { url: SHARP_EXTENSION.CONTEXT_SOURCE, valueString: ctx.sourceAgent },
  ];

  if (ctx.evidenceLinks && ctx.evidenceLinks.length > 0) {
    for (const link of ctx.evidenceLinks) {
      const sub: FhirExtension[] = [
        { url: 'documentReference', valueReference: { reference: `DocumentReference/${link.documentReference}` } },
        { url: 'snippet', valueString: link.snippet.slice(0, 300) },
      ];
      if (link.findingId) sub.push({ url: 'findingId', valueString: link.findingId });
      if (link.category)  sub.push({ url: 'category',  valueString: link.category });
      if (link.severity)  sub.push({ url: 'severity',  valueString: link.severity });
      out.push({ url: SHARP_EXTENSION.EVIDENCE_LINK, extension: sub });
    }
  }

  if (typeof ctx.confidence === 'number') {
    out.push({ url: SHARP_EXTENSION.CONFIDENCE, valueDecimal: clampConfidence(ctx.confidence) });
  }

  return out;
}

function clampConfidence(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
