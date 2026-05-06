// Routes findings from the note-extractor to specialist agents by category.
//
// Categories often span specialties (a medication finding can affect cardiac
// AND metabolic risk), so domains overlap intentionally. Each specialist
// applies its own logic to decide whether a finding modifies its inputs.

import type { ClinicalFinding, FindingCategory } from '@preop-intel/shared';

export type SpecialistDomain = 'cardiac' | 'pulmonary' | 'metabolic';

const DOMAIN_CATEGORIES: Record<SpecialistDomain, FindingCategory[]> = {
  cardiac:   ['cardiac-event', 'medication', 'functional'],
  pulmonary: ['respiratory', 'functional'],
  metabolic: ['metabolic', 'medication'],
};

export function routeFindingsToSpecialist(
  findings: ClinicalFinding[],
  domain: SpecialistDomain,
): ClinicalFinding[] {
  const categories = DOMAIN_CATEGORIES[domain];
  return findings.filter(f => categories.includes(f.category));
}
