import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RCRI_RISK_MAP, ARISCAT_CUTOFFS } from '@preop-intel/shared';
import type { RcriInput, RcriResult, AriscatInput, AriscatResult } from '@preop-intel/shared';

// ─── RCRI Calculator ─────────────────────────────────────────────────────────
// Revised Cardiac Risk Index — 6 binary criteria, score 0-6.
// Source: Lee TH et al. Circulation. 1999;100(10):1043-1049.
// https://www.ahajournals.org/doi/10.1161/01.cir.100.10.1043
//
// Why RCRI over NSQIP or other scores?
// RCRI is ACC/AHA guideline-recommended for non-cardiac surgery and can be
// fully automated from FHIR data (6 yes/no criteria from Conditions + Observations).
// NSQIP requires 20+ manually entered variables.
// Source: 2014 ACC/AHA Perioperative Guidelines
// https://www.ahajournals.org/doi/10.1161/CIR.0000000000000106
//
// Limitation: Validated on ≥50yo major non-cardiac surgery, predominantly white
// males. May overestimate risk in younger patients or minor procedures.

export function calculateRcri(input: RcriInput): RcriResult {
  const score = Object.values(input).filter(Boolean).length;

  // Score ≥3 maps to the same bucket (≥11% risk) per the original derivation
  const risk = score >= 3
    ? { percent: 11, category: 'High' as const }
    : RCRI_RISK_MAP[score];

  return {
    score,
    criteria: input,
    riskPercent: risk.percent,
    riskCategory: risk.category,
    interpretation: buildRcriInterpretation(score, risk.percent, input),
  };
}

function buildRcriInterpretation(score: number, riskPercent: number, criteria: RcriInput): string {
  const activeFactors = Object.entries(criteria)
    .filter(([, v]) => v)
    .map(([k]) => k);

  if (score === 0) return 'Very low cardiac risk. Proceed with surgery.';
  if (score === 1) return `Low cardiac risk (${riskPercent}%). Active factor: ${activeFactors.join(', ')}.`;
  if (score === 2) return `Moderate cardiac risk (${riskPercent}%). Consider cardiology review. Active factors: ${activeFactors.join(', ')}.`;
  return `High cardiac risk (${riskPercent}%). Cardiology consultation recommended. Active factors: ${activeFactors.join(', ')}.`;
}

// ─── ARISCAT Calculator ──────────────────────────────────────────────────────
// Assess Respiratory Risk in Surgical Patients in Catalonia.
// 7 weighted factors → total score → PPC risk category.
// Source: Canet J et al. Anesthesiology. 2010;113(6):1338-1350.
// https://pubs.asahq.org/anesthesiology/article/113/6/1338/10737
//
// Limitation: Requires surgery type and duration — not always in FHIR pre-op.
// We get these from the surgeon's `plannedProcedure` context.
// Originally validated in a European (Catalonia) population.

export function calculateAriscat(input: AriscatInput): AriscatResult {
  let score = 0;

  // Age scoring (points from original Canet 2010 Table 3)
  if (input.age >= 51 && input.age <= 80) score += 3;
  else if (input.age > 80) score += 16;

  // SpO2 scoring
  if (input.spo2Preop >= 91 && input.spo2Preop <= 95) score += 8;
  else if (input.spo2Preop <= 90) score += 24;

  // Respiratory infection in last month
  if (input.respiratoryInfectionLastMonth) score += 17;

  // Pre-op anemia
  if (input.preopHemoglobin <= 10) score += 11;

  // Surgical incision site
  if (input.surgicalIncisionSite === 'upper_abdominal') score += 15;
  else if (input.surgicalIncisionSite === 'intrathoracic') score += 24;

  // Surgery duration
  if (input.surgeryDurationHours >= 2 && input.surgeryDurationHours < 3) score += 16;
  else if (input.surgeryDurationHours >= 3) score += 23;

  // Emergency
  if (input.emergencySurgery) score += 8;

  // Risk stratification per original ARISCAT cutoffs
  let riskCategory: AriscatResult['riskCategory'];
  let ppcRisk: string;

  if (score < 26) {
    riskCategory = 'Low';
    ppcRisk = ARISCAT_CUTOFFS.Low.ppcRisk;
  } else if (score <= 44) {
    riskCategory = 'Intermediate';
    ppcRisk = ARISCAT_CUTOFFS.Intermediate.ppcRisk;
  } else {
    riskCategory = 'High';
    ppcRisk = ARISCAT_CUTOFFS.High.ppcRisk;
  }

  return {
    score,
    riskCategory,
    ppcRisk,
    recommendations: buildAriscatRecs(riskCategory, input),
  };
}

function buildAriscatRecs(risk: AriscatResult['riskCategory'], input: AriscatInput): string[] {
  const recs: string[] = [];
  if (input.spo2Preop <= 95) recs.push('Optimize oxygenation pre-operatively');
  if (input.respiratoryInfectionLastMonth) recs.push('Consider delaying elective surgery until infection resolved (min 4 weeks)');
  if (input.preopHemoglobin <= 10) recs.push('Evaluate and treat anemia before surgery');
  if (risk === 'High') recs.push('Pulmonology consultation recommended', 'Consider lung-protective ventilation strategy');
  if (risk === 'Intermediate') recs.push('Incentive spirometry training pre-operatively');
  return recs;
}

// ─── MCP Tool Registration ───────────────────────────────────────────────────

export function registerCalculatorTools(server: McpServer) {
  server.tool(
    'calculate_rcri_score',
    'Calculates the Revised Cardiac Risk Index score (0-6) and perioperative MACE risk percentage',
    {
      highRiskSurgery: z.boolean().describe('Suprainguinal vascular, intrathoracic, or intraperitoneal surgery'),
      ischemicHeartDisease: z.boolean().describe('History of MI, positive stress test, angina, nitrate use, or ECG Q waves'),
      heartFailureHistory: z.boolean().describe('History of CHF, pulmonary edema, PND, bilateral rales, or S3 gallop'),
      cerebrovascularDisease: z.boolean().describe('History of stroke or TIA'),
      diabetesOnInsulin: z.boolean().describe('Pre-operative insulin use'),
      creatinineAbove2: z.boolean().describe('Pre-operative creatinine > 2.0 mg/dL'),
    },
    async (input) => {
      const result = calculateRcri(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'calculate_ariscat_score',
    'Calculates the ARISCAT score for postoperative pulmonary complication risk',
    {
      age: z.number().describe('Patient age in years'),
      spo2Preop: z.number().describe('Pre-operative SpO2 percentage'),
      respiratoryInfectionLastMonth: z.boolean().describe('Respiratory infection within the last month'),
      preopHemoglobin: z.number().describe('Pre-operative hemoglobin in g/dL'),
      surgicalIncisionSite: z.enum(['peripheral', 'upper_abdominal', 'intrathoracic']).describe('Surgical incision site category'),
      surgeryDurationHours: z.number().describe('Estimated surgery duration in hours'),
      emergencySurgery: z.boolean().describe('Whether this is an emergency surgery'),
    },
    async (input) => {
      const result = calculateAriscat(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
