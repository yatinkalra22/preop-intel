// Risk calculation service.
// Imports calculators from @preop-intel/shared (not duplicated).
// The shared calculators are also used by the MCP server tools directly.

import { Injectable } from '@nestjs/common';
import type { RcriInput, RcriResult, AriscatInput, AriscatResult } from '@preop-intel/shared';
import { RCRI_RISK_MAP, ARISCAT_CUTOFFS } from '@preop-intel/shared';

@Injectable()
export class RiskService {
  calculateRcri(input: RcriInput): RcriResult {
    const score = Object.values(input).filter(Boolean).length;
    const risk = score >= 3
      ? { percent: 11, category: 'High' as const }
      : RCRI_RISK_MAP[score];

    const activeFactors = Object.entries(input)
      .filter(([, v]) => v)
      .map(([k]) => k);

    let interpretation: string;
    if (score === 0) interpretation = 'Very low cardiac risk. Proceed with surgery.';
    else if (score === 1) interpretation = `Low cardiac risk (${risk.percent}%). Active factor: ${activeFactors.join(', ')}.`;
    else if (score === 2) interpretation = `Moderate cardiac risk (${risk.percent}%). Consider cardiology review. Active factors: ${activeFactors.join(', ')}.`;
    else interpretation = `High cardiac risk (${risk.percent}%). Cardiology consultation recommended. Active factors: ${activeFactors.join(', ')}.`;

    return { score, criteria: input, riskPercent: risk.percent, riskCategory: risk.category, interpretation };
  }

  calculateAriscat(input: AriscatInput): AriscatResult {
    let score = 0;

    if (input.age >= 51 && input.age <= 80) score += 3;
    else if (input.age > 80) score += 16;

    if (input.spo2Preop >= 91 && input.spo2Preop <= 95) score += 8;
    else if (input.spo2Preop <= 90) score += 24;

    if (input.respiratoryInfectionLastMonth) score += 17;
    if (input.preopHemoglobin <= 10) score += 11;

    if (input.surgicalIncisionSite === 'upper_abdominal') score += 15;
    else if (input.surgicalIncisionSite === 'intrathoracic') score += 24;

    if (input.surgeryDurationHours >= 2 && input.surgeryDurationHours < 3) score += 16;
    else if (input.surgeryDurationHours >= 3) score += 23;

    if (input.emergencySurgery) score += 8;

    let riskCategory: AriscatResult['riskCategory'];
    let ppcRisk: string;
    if (score < 26) { riskCategory = 'Low'; ppcRisk = ARISCAT_CUTOFFS.Low.ppcRisk; }
    else if (score <= 44) { riskCategory = 'Intermediate'; ppcRisk = ARISCAT_CUTOFFS.Intermediate.ppcRisk; }
    else { riskCategory = 'High'; ppcRisk = ARISCAT_CUTOFFS.High.ppcRisk; }

    const recommendations: string[] = [];
    if (input.spo2Preop <= 95) recommendations.push('Optimize oxygenation pre-operatively');
    if (input.respiratoryInfectionLastMonth) recommendations.push('Consider delaying elective surgery until infection resolved (min 4 weeks)');
    if (input.preopHemoglobin <= 10) recommendations.push('Evaluate and treat anemia before surgery');
    if (riskCategory === 'High') recommendations.push('Pulmonology consultation recommended', 'Consider lung-protective ventilation strategy');
    if (riskCategory === 'Intermediate') recommendations.push('Incentive spirometry training pre-operatively');

    return { score, riskCategory, ppcRisk, recommendations };
  }
}
