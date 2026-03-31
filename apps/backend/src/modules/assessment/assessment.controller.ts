import { Controller, Post, Get, Param, Body, Sse, Inject, forwardRef, BadRequestException } from '@nestjs/common';
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

  private validateStartPayload(body: StartAssessmentRequest) {
    if (!body?.patientId || body.patientId.length > 200) {
      throw new BadRequestException('Invalid patientId');
    }
    if (!body?.plannedProcedure || body.plannedProcedure.length > 500) {
      throw new BadRequestException('Invalid plannedProcedure');
    }
    if (!body?.accessToken || body.accessToken.length > 8000) {
      throw new BadRequestException('Invalid accessToken');
    }
    if (body.fhirBaseUrl !== 'demo') {
      let parsed: URL;
      try {
        parsed = new URL(body.fhirBaseUrl);
      } catch {
        throw new BadRequestException('Invalid fhirBaseUrl');
      }
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
        throw new BadRequestException('fhirBaseUrl must use HTTPS');
      }
    }
  }

  /** Start a new risk assessment — creates session then runs agent pipeline */
  @Post('start')
  async startAssessment(@Body() body: StartAssessmentRequest) {
    this.validateStartPayload(body);
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
