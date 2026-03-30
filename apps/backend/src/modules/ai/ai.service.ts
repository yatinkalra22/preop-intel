// Claude AI integration for risk synthesis.
//
// Why claude-sonnet-4-5 (not Opus)?
// - 5x cheaper per token. Each assessment ~2000 output tokens.
// - 2-3x faster response. Real-time demo needs speed > quality margin.
// - Sufficient for structured JSON from provided risk data — we're not asking
//   for novel medical reasoning, just synthesis of structured inputs.
// Source: https://docs.anthropic.com/en/docs/about-claude/models
//
// Why single orchestrator prompt (not per-domain)?
// Risk scores are already structured from calculators. The orchestrator's job
// is cross-domain synthesis. Separate per-domain AI calls add latency/cost
// without improving quality.

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { RcriResult, AriscatResult } from '@preop-intel/shared';
import { buildOrchestratorPrompt } from './prompts/orchestrator.prompt';

export interface SynthesisInput {
  patient: any;
  rcri: RcriResult;
  ariscat: AriscatResult;
  metabolicRisk: any;
  medicationRisk: any;
  plannedProcedure: string;
}

export interface SynthesisOutput {
  overallRisk: 'Low' | 'Moderate' | 'High' | 'Very High';
  overallRiskPercent: number;
  clinicalNarrative: string;
  urgentConcerns: string[];
  recommendations: Array<{ action: string; urgency: string; rationale: string }>;
  safeToProceed: boolean;
  optimizationRequired: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    });
  }

  async synthesizeRiskAssessment(params: SynthesisInput): Promise<SynthesisOutput> {
    const prompt = buildOrchestratorPrompt(params);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20241022',
      max_tokens: 2000,
      // Why anesthesiologist persona? Gives Claude domain context for
      // interpreting risk scores and generating clinically appropriate recs.
      // Why "Output valid JSON only"? Prevents conversational text that breaks parsing.
      system: `You are a board-certified anesthesiologist performing pre-operative risk assessment.
You have access to the patient's complete medical record. Your job is to synthesize all risk domains
into a comprehensive, clinically actionable assessment. Be specific, cite exact values, and give
concrete recommendations with urgency levels. Output valid JSON only.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (response.content[0] as Anthropic.TextBlock).text;

    try {
      // Strip markdown code fences if Claude wraps the JSON
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as SynthesisOutput;
    } catch (err) {
      this.logger.error('Failed to parse Claude response as JSON', text);
      // Fallback: return a safe default
      return {
        overallRisk: 'Moderate',
        overallRiskPercent: 5,
        clinicalNarrative: 'AI synthesis encountered a parsing error. Please review individual risk scores.',
        urgentConcerns: [],
        recommendations: [],
        safeToProceed: false,
        optimizationRequired: true,
      };
    }
  }
}
