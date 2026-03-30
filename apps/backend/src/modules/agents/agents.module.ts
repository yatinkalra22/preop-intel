import { Module, forwardRef } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { FhirModule } from '../fhir/fhir.module';
import { RiskModule } from '../risk/risk.module';
import { AiModule } from '../ai/ai.module';
import { AssessmentModule } from '../assessment/assessment.module';

@Module({
  imports: [FhirModule, RiskModule, AiModule, forwardRef(() => AssessmentModule)],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
