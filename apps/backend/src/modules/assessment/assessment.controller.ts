import { Controller, Post, Get, Param, Body, Sse, Inject, forwardRef } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AssessmentService } from './assessment.service';
import { AgentsService } from '../agents/agents.service';
import type { StartAssessmentRequest } from '@preop-intel/shared';

@Controller('assessments')
export class AssessmentController {
  constructor(
    private readonly assessmentService: AssessmentService,
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
  ) {}

  /** Start a new risk assessment — creates session then runs agent pipeline */
  @Post('start')
  async startAssessment(@Body() body: StartAssessmentRequest) {
    const { id } = await this.assessmentService.startAssessment(body);

    // Run agent pipeline asynchronously — results stream via SSE
    // Don't await — return ID immediately so frontend can connect to SSE
    this.agentsService.runAssessment({
      assessmentId: id,
      ...body,
    }).catch(err => {
      this.assessmentService.emitAgentUpdate(id, {
        agentName: 'orchestrator',
        status: 'error',
        error: err instanceof Error ? err.message : 'Assessment pipeline failed',
      });
      this.assessmentService.updateSession(id, { status: 'failed' });
    });

    return { id };
  }

  /** Get assessment result by ID */
  @Get(':id')
  async getAssessment(@Param('id') id: string) {
    return this.assessmentService.getAssessment(id);
  }

  /** SSE endpoint for real-time agent status updates */
  @Sse(':id/stream')
  streamAssessment(@Param('id') id: string): Observable<MessageEvent> {
    return this.assessmentService.getAssessmentStream(id);
  }

  /** Get all assessments for a patient */
  @Get('patient/:patientId')
  async getPatientAssessments(@Param('patientId') patientId: string) {
    return this.assessmentService.getPatientAssessments(patientId);
  }
}
