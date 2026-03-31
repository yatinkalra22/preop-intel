import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { AssessmentSession } from './assessment.entity';
import { AgentsModule } from '../agents/agents.module';
import { AuditService } from '../security/audit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssessmentSession]),
    forwardRef(() => AgentsModule),
  ],
  controllers: [AssessmentController],
  providers: [AssessmentService, AuditService],
  exports: [AssessmentService],
})
export class AssessmentModule {}
