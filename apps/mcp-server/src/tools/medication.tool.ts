import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FhirClient } from '../fhir/client.js';

/**
 * get_medication_risk_data
 * Reads: MedicationRequest (active), AllergyIntolerance
 *
 * Why display name matching (not RxNorm codes)? MeldRx sandbox may not have
 * consistent RxNorm coding. Display name matching is more reliable for a
 * hackathon demo. In production, you'd match on RxNorm codes.
 */

// Perioperative medication risk patterns
// Source: ACC/AHA 2014 Perioperative Guidelines, Section 6.3
// https://www.ahajournals.org/doi/10.1161/CIR.0000000000000106
const MEDICATION_PATTERNS: Array<{
  pattern: RegExp;
  category: 'anticoagulant' | 'nsaid' | 'insulin' | 'supplement';
  concern: string;
  recommendation: string;
}> = [
  {
    pattern: /warfarin|coumadin/i,
    category: 'anticoagulant',
    concern: 'Increased bleeding risk during surgery',
    recommendation: 'Discontinue 5 days pre-op, bridge with LMWH if indicated',
  },
  {
    pattern: /rivaroxaban|xarelto|apixaban|eliquis|dabigatran|pradaxa|edoxaban/i,
    category: 'anticoagulant',
    concern: 'DOAC — increased bleeding risk',
    recommendation: 'Hold 48-72 hours pre-op depending on renal function',
  },
  {
    pattern: /clopidogrel|plavix|prasugrel|ticagrelor/i,
    category: 'anticoagulant',
    concern: 'Antiplatelet — increased bleeding risk',
    recommendation: 'Hold 5-7 days pre-op unless recent coronary stent',
  },
  {
    pattern: /aspirin/i,
    category: 'anticoagulant',
    concern: 'Antiplatelet effect — mild bleeding risk',
    recommendation: 'Continue for cardiac-risk patients, hold for low-risk patients per surgeon preference',
  },
  {
    pattern: /ibuprofen|advil|naproxen|aleve|diclofenac|meloxicam|celecoxib/i,
    category: 'nsaid',
    concern: 'NSAIDs impair platelet function and renal perfusion',
    recommendation: 'Discontinue 3-5 days pre-op',
  },
  {
    pattern: /insulin\s*glargine|lantus|insulin\s*detemir|levemir|insulin\s*degludec|tresiba/i,
    category: 'insulin',
    concern: 'Hypoglycemia risk during NPO period',
    recommendation: 'Reduce basal insulin dose by 50% evening before surgery',
  },
  {
    pattern: /insulin\s*lispro|humalog|insulin\s*aspart|novolog/i,
    category: 'insulin',
    concern: 'Rapid-acting insulin — hypoglycemia risk during NPO',
    recommendation: 'Hold on morning of surgery',
  },
  {
    pattern: /ginkgo|garlic\s*supplement|ginseng|fish\s*oil|omega|st\.?\s*john/i,
    category: 'supplement',
    concern: 'Herbal supplements may increase bleeding or interact with anesthesia',
    recommendation: 'Discontinue 2 weeks pre-op',
  },
];

export function registerMedicationTool(server: McpServer) {
  server.tool(
    'get_medication_risk_data',
    'Identifies perioperative medication risks from active prescriptions and allergies',
    {
      patientId: z.string(),
      fhirBaseUrl: z.string(),
      accessToken: z.string(),
    },
    async ({ patientId, fhirBaseUrl, accessToken }) => {
      const fhir = new FhirClient(fhirBaseUrl, accessToken);

      const [medications, allergies] = await Promise.all([
        fhir.search('MedicationRequest', {
          patient: patientId,
          status: 'active',
          _count: '100',
        }),
        fhir.search('AllergyIntolerance', {
          patient: patientId,
          _count: '50',
        }),
      ]);

      // Scan each active medication against risk patterns
      const flags: Array<{
        medication: string;
        category: string;
        concern: string;
        recommendation: string;
      }> = [];

      const medEntries = medications.entry ?? [];
      for (const entry of medEntries) {
        const med = entry.resource;
        const medName = med.medicationCodeableConcept?.text
          ?? med.medicationCodeableConcept?.coding?.[0]?.display
          ?? '';

        for (const pattern of MEDICATION_PATTERNS) {
          if (pattern.pattern.test(medName)) {
            flags.push({
              medication: medName,
              category: pattern.category,
              concern: pattern.concern,
              recommendation: pattern.recommendation,
            });
            break; // One flag per medication
          }
        }
      }

      // Extract allergies
      const allergyList = (allergies.entry ?? []).map((e: any) => ({
        substance: e.resource.code?.text ?? e.resource.code?.coding?.[0]?.display ?? 'Unknown',
        type: e.resource.type ?? 'unknown',
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ flags, allergies: allergyList }),
        }],
      };
    },
  );
}
