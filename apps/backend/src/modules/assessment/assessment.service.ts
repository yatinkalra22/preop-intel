import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, Observable } from 'rxjs';
import { AssessmentSession } from './assessment.entity';
import type { StartAssessmentRequest, AgentStatusUpdate } from '@preop-intel/shared';

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  // SSE streams keyed by assessment ID
  private streams = new Map<string, Subject<MessageEvent>>();

  constructor(
    @InjectRepository(AssessmentSession)
    private readonly repo: Repository<AssessmentSession>,
  ) {}

  /** Create a new assessment session and return its ID */
  async startAssessment(params: StartAssessmentRequest): Promise<{ id: string }> {
    const session = this.repo.create({
      patientId: params.patientId,
      fhirBaseUrl: params.fhirBaseUrl,
      plannedProcedure: params.plannedProcedure,
      status: 'pending',
    });
    const saved = await this.repo.save(session);
    this.logger.log(`Assessment ${saved.id} created for patient ${params.patientId}`);

    // Create SSE stream for this assessment
    this.streams.set(saved.id, new Subject<MessageEvent>());

    // Phase 7 will trigger the actual agent orchestration here
    // For now, just mark as pending
    return { id: saved.id };
  }

  /** Get assessment by ID */
  async getAssessment(id: string): Promise<AssessmentSession> {
    const session = await this.repo.findOne({ where: { id } });
    if (!session) throw new NotFoundException(`Assessment ${id} not found`);
    return session;
  }

  /** Get all assessments for a patient */
  async getPatientAssessments(patientId: string): Promise<AssessmentSession[]> {
    return this.repo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Get SSE stream for real-time agent status updates */
  getAssessmentStream(id: string): Observable<MessageEvent> {
    let stream = this.streams.get(id);
    if (!stream) {
      stream = new Subject<MessageEvent>();
      this.streams.set(id, stream);
    }
    return stream.asObservable();
  }

  /** Emit an agent status update to the SSE stream */
  emitAgentUpdate(assessmentId: string, update: AgentStatusUpdate): void {
    const stream = this.streams.get(assessmentId);
    if (stream) {
      stream.next({ data: JSON.stringify(update) } as MessageEvent);
    }
  }

  /** Update assessment session in database */
  async updateSession(id: string, updates: Partial<AssessmentSession>): Promise<void> {
    await this.repo.update(id, updates as any);
  }
}
