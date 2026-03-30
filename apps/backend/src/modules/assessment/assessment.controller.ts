import { Controller, Post, Get, Param, Body, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AssessmentService } from './assessment.service';
import type { StartAssessmentRequest } from '@preop-intel/shared';

@Controller('assessments')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  /** Start a new risk assessment for a patient */
  @Post('start')
  async startAssessment(@Body() body: StartAssessmentRequest) {
    return this.assessmentService.startAssessment(body);
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
