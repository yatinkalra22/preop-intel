// Cancellation-risk service.
//
// Score and cost band: deterministic, citable. Pure functions exported for tests.
// Action plan: AI-generated narrative.
//
// Score weights and cost contributions live in @preop-intel/shared so they can
// be audited from a single place. Citations in cancellation.types.ts header.

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  SEVERITY_COST_CONTRIBUTION,
  SEVERITY_SCORE_WEIGHT,
  SURGERY_COST_PROFILES,
  type CancellationRisk,
  type CancellationScoreInput,
  type ClinicalFinding,
  type PreventableIssue,
  type FindingCategory,
} from '@preop-intel/shared';

@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);
  private readonly client: Anthropic;
  private readonly model = process.env.ACTION_PLAN_MODEL ?? 'claude-sonnet-4-6';

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }

  async assess(input: CancellationScoreInput & { plannedProcedureLabel: string }): Promise<CancellationRisk> {
    const { score, severityCounts, daysToSurgeryMultiplier } = computeCancellationScore(input);
    const { low: costLow, high: costHigh, profile } = computeCostBand(input);
    const preventableIssues = derivePreventableIssues(input.findings, input.daysToSurgery);

    let actionPlan = '';
    if (preventableIssues.length > 0) {
      try {
        actionPlan = await this.generateActionPlan({
          plannedProcedureLabel: input.plannedProcedureLabel,
          daysToSurgery: input.daysToSurgery,
          preventableIssues,
          findings: input.findings,
        });
      } catch (err) {
        this.logger.error('Action-plan generation failed, using fallback', err);
        actionPlan = fallbackActionPlan(preventableIssues);
      }
    }

    return {
      score,
      estimatedCostAvoidanceLow: costLow,
      estimatedCostAvoidanceHigh: costHigh,
      preventableIssues,
      actionPlan,
      inputs: {
        findingCount: input.findings.length,
        severityCounts,
        daysToSurgery: input.daysToSurgery,
        surgeryType: String(input.surgeryType),
        orHourRateLow: profile.orHourRateLow,
        orHourRateHigh: profile.orHourRateHigh,
        estimatedOrHours: profile.estimatedOrHours,
      },
    };
  }

  private async generateActionPlan(params: {
    plannedProcedureLabel: string;
    daysToSurgery: number;
    preventableIssues: PreventableIssue[];
    findings: ClinicalFinding[];
  }): Promise<string> {
    const prompt = buildActionPlanPrompt(params);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 800,
      system: ACTION_PLAN_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    return (response.content[0] as Anthropic.TextBlock).text.trim();
  }
}

// ─── Pure exports (deterministic, testable) ───────────────────────────────────

export function computeCancellationScore(input: CancellationScoreInput): {
  score: number;
  severityCounts: Record<'low' | 'moderate' | 'high' | 'critical', number>;
  daysToSurgeryMultiplier: number;
} {
  const severityCounts = countBySeverity(input.findings);

  const rawScore =
    severityCounts.low * SEVERITY_SCORE_WEIGHT.low
    + severityCounts.moderate * SEVERITY_SCORE_WEIGHT.moderate
    + severityCounts.high * SEVERITY_SCORE_WEIGHT.high
    + severityCounts.critical * SEVERITY_SCORE_WEIGHT.critical;

  const daysToSurgeryMultiplier = urgencyMultiplier(input.daysToSurgery);
  const score = Math.min(100, Math.round(rawScore * daysToSurgeryMultiplier));

  return { score, severityCounts, daysToSurgeryMultiplier };
}

export function computeCostBand(input: CancellationScoreInput): {
  low: number;
  high: number;
  profile: ReturnType<typeof getProfile>;
} {
  const profile = getProfile(input.surgeryType);

  const findingsLow = input.findings.reduce(
    (sum, f) => sum + SEVERITY_COST_CONTRIBUTION[f.severity].low,
    0,
  );
  const findingsHigh = input.findings.reduce(
    (sum, f) => sum + SEVERITY_COST_CONTRIBUTION[f.severity].high,
    0,
  );

  const orRescheduleLow = profile.orHourRateLow * profile.estimatedOrHours * 0.4;
  const orRescheduleHigh = profile.orHourRateHigh * profile.estimatedOrHours * 0.6;

  const urgencyMult = urgencyMultiplier(input.daysToSurgery);

  const low = Math.round((profile.baseCancellationOverhead + findingsLow + orRescheduleLow) * urgencyMult);
  const high = Math.round((profile.baseCancellationOverhead + findingsHigh + orRescheduleHigh) * urgencyMult);

  return { low, high, profile };
}

export function derivePreventableIssues(
  findings: ClinicalFinding[],
  daysToSurgery: number,
): PreventableIssue[] {
  return findings
    .filter(f => f.severity !== 'low')
    .map(f => ({
      id: `issue-${f.id}`,
      issue: f.finding,
      daysToFix: estimateDaysToFix(f.severity, daysToSurgery),
      owner: ownerForCategory(f.category),
      action: f.riskImplication,
      sourceFindingId: f.id,
    }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countBySeverity(findings: ClinicalFinding[]) {
  const out = { low: 0, moderate: 0, high: 0, critical: 0 };
  for (const f of findings) out[f.severity] += 1;
  return out;
}

function urgencyMultiplier(daysToSurgery: number): number {
  if (daysToSurgery <= 1) return 1.5;
  if (daysToSurgery <= 3) return 1.3;
  if (daysToSurgery <= 7) return 1.1;
  return 1.0;
}

function getProfile(surgeryType: string) {
  return SURGERY_COST_PROFILES[surgeryType] ?? SURGERY_COST_PROFILES.default;
}

function estimateDaysToFix(severity: ClinicalFinding['severity'], daysToSurgery: number): number {
  const ideal = severity === 'critical' ? 1 : severity === 'high' ? 3 : 7;
  return Math.min(ideal, Math.max(1, daysToSurgery - 1));
}

function ownerForCategory(category: FindingCategory): PreventableIssue['owner'] {
  switch (category) {
    case 'medication':    return 'anesthesia';
    case 'cardiac-event': return 'cardiology';
    case 'functional':    return 'cardiology';
    case 'respiratory':   return 'primary-care';
    case 'metabolic':     return 'endocrinology';
    default:              return 'surgery';
  }
}

// ─── Action plan prompt ───────────────────────────────────────────────────────

const ACTION_PLAN_SYSTEM = `You are a peri-operative care coordinator. Produce a concise,
clinically grounded coordinated action plan that prevents avoidable surgical cancellation.
Output is a short markdown list grouped by owner. Each item is one short sentence with a
specific action and a deadline relative to surgery day. Cite a guideline only when relevant.
No preamble, no closing remarks, no commentary about the plan itself.`;

function buildActionPlanPrompt(params: {
  plannedProcedureLabel: string;
  daysToSurgery: number;
  preventableIssues: PreventableIssue[];
  findings: ClinicalFinding[];
}): string {
  const issueLines = params.preventableIssues
    .map(i => `- [${i.owner}] ${i.issue} — fix within ${i.daysToFix} day(s). Action context: ${i.action}.`)
    .join('\n');

  const findingLines = params.findings
    .map(f => `- ${f.severity.toUpperCase()} ${f.category}: ${f.finding}${f.guidelineRef ? ` (${f.guidelineRef})` : ''}`)
    .join('\n');

  return `Procedure: ${params.plannedProcedureLabel}
Days to surgery: ${params.daysToSurgery}

Findings driving cancellation risk:
${findingLines}

Preventable issues, by owner:
${issueLines}

Produce the markdown plan.`;
}

function fallbackActionPlan(issues: PreventableIssue[]): string {
  const byOwner = new Map<string, string[]>();
  for (const i of issues) {
    const list = byOwner.get(i.owner) ?? [];
    list.push(`- ${i.issue} — within ${i.daysToFix} day(s): ${i.action}`);
    byOwner.set(i.owner, list);
  }
  return Array.from(byOwner.entries())
    .map(([owner, lines]) => `**${owner}**\n${lines.join('\n')}`)
    .join('\n\n');
}
