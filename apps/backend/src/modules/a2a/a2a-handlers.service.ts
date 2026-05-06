// Per-agent task handlers. Each handler accepts a typed input and returns the
// same artifact the in-process pipeline produces — guaranteeing
// A2A_MODE=live and A2A_MODE=local yield identical assessment output.

import { Injectable, Logger } from '@nestjs/common';
import { NoteExtractorService } from '../agents/note-extractor.service';
import {
  applyFindingsToCardiac,
  applyFindingsToPulmonary,
  applyFindingsToMetabolic,
} from '../agents/findings-application';
import type {
  AriscatInput,
  ClinicalDocument,
  ClinicalFinding,
  MetabolicRiskData,
  NoteExtractorInput,
  NoteExtractorOutput,
  RcriInput,
} from '@preop-intel/shared';

@Injectable()
export class A2AHandlersService {
  private readonly logger = new Logger(A2AHandlersService.name);

  constructor(
    private readonly noteExtractor: NoteExtractorService,
  ) {}

  async handleNoteExtractor(input: unknown): Promise<NoteExtractorOutput> {
    const typed = input as NoteExtractorInput;
    return this.noteExtractor.extract(typed);
  }

  async handleCardiac(input: unknown) {
    const typed = input as { structured: RcriInput; findings: ClinicalFinding[] };
    return applyFindingsToCardiac(typed.structured, typed.findings ?? []);
  }

  async handlePulmonary(input: unknown) {
    const typed = input as { structured: AriscatInput; findings: ClinicalFinding[] };
    return applyFindingsToPulmonary(typed.structured, typed.findings ?? []);
  }

  async handleMetabolic(input: unknown) {
    const typed = input as { structured: MetabolicRiskData; findings: ClinicalFinding[] };
    return applyFindingsToMetabolic(typed.structured, typed.findings ?? []);
  }

  // The orchestrator endpoint is a stub for now — registered so the agent
  // card is discoverable on Prompt Opinion. The real demo orchestration runs
  // in AgentsService.runAssessment(). Day 5 (publishing) wires this up to
  // actually drive an assessment when invoked externally.
  async handleOrchestrator(_input: unknown) {
    return {
      status: 'not-implemented',
      hint: 'Orchestrator agent is registered for marketplace discovery; invoke /api/assessments/start for end-to-end execution.',
    };
  }
}
