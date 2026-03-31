import { Controller, Post, Get, Param, Body, Sse, Inject, forwardRef, BadRequestException, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { AssessmentService } from './assessment.service';
import { AgentsService } from '../agents/agents.service';
import type { StartAssessmentRequest } from '@preop-intel/shared';
import { AuditService } from '../security/audit.service';

@Controller('assessments')
export class AssessmentController {
  constructor(
    private readonly assessmentService: AssessmentService,
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
    private readonly auditService: AuditService,
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
  async startAssessment(@Body() body: StartAssessmentRequest, @Req() req: Request) {
    this.validateStartPayload(body);
    const { id } = await this.assessmentService.startAssessment(body);

    this.auditService.log({
      action: 'assessment.start',
      outcome: 'success',
      requestId: (req as any).requestId,
      ip: req.ip,
      assessmentId: id,
      patientId: body.patientId,
      details: { mode: body.fhirBaseUrl === 'demo' ? 'demo' : 'live' },
    });

    // Run agent pipeline asynchronously — results stream via SSE
    // Don't await — return ID immediately so frontend can connect to SSE
    this.agentsService.runAssessment({
      assessmentId: id,
      ...body,
    }).catch(err => {
      this.auditService.log({
        action: 'assessment.pipeline',
        outcome: 'failure',
        requestId: (req as any).requestId,
        ip: req.ip,
        assessmentId: id,
        patientId: body.patientId,
        details: { reason: err instanceof Error ? err.message : 'pipeline_failed' },
      });
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
  async getAssessment(@Param('id') id: string, @Req() req: Request) {
    this.auditService.log({
      action: 'assessment.read',
      outcome: 'success',
      requestId: (req as any).requestId,
      ip: req.ip,
      assessmentId: id,
    });
    return this.assessmentService.getAssessment(id);
  }

  /** SSE endpoint for real-time agent status updates */
  @Sse(':id/stream')
  streamAssessment(@Param('id') id: string, @Req() req: Request): Observable<MessageEvent> {
    this.auditService.log({
      action: 'assessment.stream',
      outcome: 'success',
      requestId: (req as any).requestId,
      ip: req.ip,
      assessmentId: id,
    });
    return this.assessmentService.getAssessmentStream(id);
  }

  /** Get all assessments for a patient */
  @Get('patient/:patientId')
  async getPatientAssessments(@Param('patientId') patientId: string, @Req() req: Request) {
    this.auditService.log({
      action: 'assessment.list',
      outcome: 'success',
      requestId: (req as any).requestId,
      ip: req.ip,
      patientId,
    });
    return this.assessmentService.getPatientAssessments(patientId);
  }
}
