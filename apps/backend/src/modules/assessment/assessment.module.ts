import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { AssessmentSession } from './assessment.entity';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssessmentSession]),
    forwardRef(() => AgentsModule),
  ],
  controllers: [AssessmentController],
  providers: [AssessmentService],
  exports: [AssessmentService],
})
export class AssessmentModule {}
