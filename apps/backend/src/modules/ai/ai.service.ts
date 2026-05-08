// Gemini AI integration for risk synthesis.
//
// Model choice: gemini-2.5-pro for orchestrator synthesis. The orchestrator
// reasons across structured risk scores, extracted findings, override
// provenance, and critical alerts to produce the final clinical narrative —
// quality matters more than latency here.
// Note-extractor and action-plan generation use gemini-2.5-flash (high volume,
// latency-sensitive).
//
// Override via env: ORCHESTRATOR_MODEL.

import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import type { RcriResult, AriscatResult, ClinicalFinding, FieldOverride } from '@preop-intel/shared';
import { buildOrchestratorPrompt } from './prompts/orchestrator.prompt';

export interface SynthesisInput {
  patient: any;
  rcri: RcriResult;
  ariscat: AriscatResult;
  metabolicRisk: any;
  medicationRisk: any;
  plannedProcedure: string;
  findings?: ClinicalFinding[];
  criticalAlerts?: string[];
  overrides?: FieldOverride[];
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
  private readonly client: GoogleGenAI;
  private readonly model = process.env.ORCHESTRATOR_MODEL ?? 'gemini-2.5-pro';

  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
  }

  async synthesizeRiskAssessment(params: SynthesisInput): Promise<SynthesisOutput> {
    const prompt = buildOrchestratorPrompt(params);

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        // Why anesthesiologist persona? Gives the model domain context for
        // interpreting risk scores and generating clinically appropriate recs.
        systemInstruction: `You are a board-certified anesthesiologist performing pre-operative risk assessment.
You have access to the patient's complete medical record. Your job is to synthesize all risk domains
into a comprehensive, clinically actionable assessment. Be specific, cite exact values, and give
concrete recommendations with urgency levels.`,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text ?? '';

    try {
      return JSON.parse(text) as SynthesisOutput;
    } catch (err) {
      this.logger.error('Failed to parse Gemini response as JSON', text);
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
