import { Module, forwardRef } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { NoteExtractorService } from './note-extractor.service';
import { A2AClient } from '../a2a/a2a.client';
import { FhirModule } from '../fhir/fhir.module';
import { RiskModule } from '../risk/risk.module';
import { AiModule } from '../ai/ai.module';
import { AssessmentModule } from '../assessment/assessment.module';

@Module({
  imports: [FhirModule, RiskModule, AiModule, forwardRef(() => AssessmentModule)],
  providers: [AgentsService, NoteExtractorService, A2AClient],
  exports: [AgentsService, NoteExtractorService, A2AClient],
})
export class AgentsModule {}
