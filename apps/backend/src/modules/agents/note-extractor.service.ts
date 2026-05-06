// Note-extractor: extracts clinical findings from free-text documents.
//
// Pipeline:
//   1. LLM extraction with strict JSON schema and mandatory citation per finding.
//   2. Deterministic verifier: drop any finding whose sourceSnippet does not
//      appear verbatim as a substring of the cited document.text.
//   3. Confidence gating per FINDING_CONFIDENCE thresholds.
//   4. Medication-status exception: discontinuation/hold findings always
//      route to displayState='pending-confirmation' (clinician confirms).

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  FINDING_CONFIDENCE,
  type ClinicalDocument,
  type ClinicalFinding,
  type FindingCategory,
  type NoteExtractorInput,
  type NoteExtractorOutput,
} from '@preop-intel/shared';

const MED_STATUS_KEYWORDS = /\b(stop|stopped|discontinu|hold|held|paused|paus|off)\b/i;
const SNIPPET_MIN = 5;
const SNIPPET_MAX = 300;

@Injectable()
export class NoteExtractorService {
  private readonly logger = new Logger(NoteExtractorService.name);
  private readonly client: Anthropic;
  private readonly model = process.env.NOTE_EXTRACTOR_MODEL ?? 'claude-sonnet-4-6';

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }

  async extract(input: NoteExtractorInput): Promise<NoteExtractorOutput> {
    const startedAt = Date.now();

    if (input.documents.length === 0) {
      return { findings: [], documentCount: 0, durationMs: 0, rejectedCount: 0 };
    }

    const raw = await this.callExtractor(input);
    const verified = this.verifyAndGate(raw, input.documents, input.categoryFilter);

    return {
      findings: verified.kept,
      documentCount: input.documents.length,
      durationMs: Date.now() - startedAt,
      rejectedCount: verified.rejectedCount,
    };
  }

  private async callExtractor(input: NoteExtractorInput): Promise<RawFinding[]> {
    const prompt = buildExtractionPrompt(input);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (response.content[0] as Anthropic.TextBlock).text;
    return parseFindings(text, this.logger);
  }

  private verifyAndGate(
    raw: RawFinding[],
    documents: ClinicalDocument[],
    categoryFilter?: FindingCategory[],
  ): { kept: ClinicalFinding[]; rejectedCount: number } {
    const result = verifyAndGateFindings(raw, documents, categoryFilter);
    for (const reason of result.rejectionReasons) {
      this.logger.warn(reason);
    }
    return { kept: result.kept, rejectedCount: result.rejectedCount };
  }
}

export function verifyAndGateFindings(
  raw: RawFinding[],
  documents: ClinicalDocument[],
  categoryFilter?: FindingCategory[],
): { kept: ClinicalFinding[]; rejectedCount: number; rejectionReasons: string[] } {
  const docMap = new Map(documents.map(d => [d.id, d]));
  const kept: ClinicalFinding[] = [];
  const rejectionReasons: string[] = [];
  let rejectedCount = 0;

  for (const r of raw) {
    const doc = docMap.get(r.sourceDocumentId);
    if (!doc) {
      rejectionReasons.push(`Dropping finding "${r.id}": unknown sourceDocumentId ${r.sourceDocumentId}`);
      rejectedCount += 1;
      continue;
    }

    const snippetOk =
      typeof r.sourceSnippet === 'string'
      && r.sourceSnippet.length >= SNIPPET_MIN
      && r.sourceSnippet.length <= SNIPPET_MAX
      && doc.text.includes(r.sourceSnippet);

    if (!snippetOk) {
      rejectionReasons.push(`Dropping finding "${r.id}": snippet not found verbatim in ${r.sourceDocumentId}`);
      rejectedCount += 1;
      continue;
    }

    const confidence = clamp01(r.confidence);
    if (confidence < FINDING_CONFIDENCE.HIDE_BELOW) {
      rejectedCount += 1;
      continue;
    }

    if (categoryFilter && !categoryFilter.includes(r.category)) {
      continue;
    }

    const isStatusChangeMed =
      r.category === 'medication'
      && MED_STATUS_KEYWORDS.test(`${r.finding} ${r.sourceSnippet}`);

    const displayState = isStatusChangeMed
      ? 'pending-confirmation' as const
      : confidence >= FINDING_CONFIDENCE.POSSIBLE_BELOW
        ? 'detected' as const
        : 'possible' as const;

    kept.push({
      id: r.id,
      finding: r.finding,
      category: r.category,
      riskImplication: r.riskImplication,
      guidelineRef: r.guidelineRef,
      sourceDocumentId: r.sourceDocumentId,
      sourceSnippet: r.sourceSnippet,
      confidence,
      severity: r.severity,
      displayState,
      verifiedSnippet: true,
    });
  }

  return { kept, rejectedCount, rejectionReasons };
}

// ─── Internal types & helpers ────────────────────────────────────────────────

export interface RawFinding {
  id: string;
  finding: string;
  category: FindingCategory;
  riskImplication: string;
  guidelineRef?: string;
  sourceDocumentId: string;
  sourceSnippet: string;
  confidence: number;
  severity: 'low' | 'moderate' | 'high' | 'critical';
}

const SYSTEM_PROMPT = `You are an extraction-focused clinical AI. Your only job is to surface
peri-operatively relevant findings from clinical notes. You output valid JSON, no prose.

Hard rules:
- Every finding MUST cite an exact substring from the cited document. The substring will be
  verified character-for-character. If you cannot find a verbatim snippet, do not output the finding.
- Snippets must be 5-300 characters.
- Only output findings that change peri-operative risk. Routine history is not a finding.
- If no findings are warranted, return {"findings": []}.
- Never invent. If you are unsure, set confidence below 0.6.`;

function buildExtractionPrompt(input: NoteExtractorInput): string {
  const docBlock = input.documents
    .map((d, idx) => `--- DOCUMENT ${idx + 1} ---
id: ${d.id}
type: ${d.type}
date: ${d.date}
${d.author ? `author: ${d.author}` : ''}
${d.sourceOrg ? `sourceOrg: ${d.sourceOrg}` : ''}
TEXT:
${d.text}`)
    .join('\n\n');

  const filter = input.categoryFilter && input.categoryFilter.length > 0
    ? `\n\nFilter findings to these categories only: ${input.categoryFilter.join(', ')}.`
    : '';

  return `PATIENT CONTEXT:
- Age: ${input.patientContext.age}
- Sex: ${input.patientContext.sex}
- Planned procedure: ${input.patientContext.plannedProcedure}${filter}

DOCUMENTS:
${docBlock}

OUTPUT SCHEMA:
{
  "findings": [{
    "id": "kebab-case-unique-id",
    "finding": "short clinical statement",
    "category": "medication" | "functional" | "cardiac-event" | "respiratory" | "metabolic" | "other",
    "riskImplication": "how this changes peri-op risk",
    "guidelineRef": "specific guideline citation, optional",
    "sourceDocumentId": "must match one of the document ids above",
    "sourceSnippet": "exact substring from that document, 5-300 chars",
    "confidence": 0.0-1.0,
    "severity": "low" | "moderate" | "high" | "critical"
  }]
}

OUTPUT VALID JSON ONLY.`;
}

function parseFindings(text: string, logger: Logger): RawFinding[] {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.findings)) return parsed.findings;
    logger.warn('Extractor returned no findings array');
    return [];
  } catch (err) {
    logger.error('Failed to parse extractor JSON', text);
    return [];
  }
}

function clamp01(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
