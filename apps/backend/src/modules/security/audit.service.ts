import { Injectable, Logger } from '@nestjs/common';

type AuditPayload = {
  action: string;
  outcome: 'success' | 'failure';
  requestId?: string;
  ip?: string;
  patientId?: string;
  assessmentId?: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  log(payload: AuditPayload) {
    this.logger.log(
      JSON.stringify({
        at: new Date().toISOString(),
        ...payload,
      }),
    );
  }
}
