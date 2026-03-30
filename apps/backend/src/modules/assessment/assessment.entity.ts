// Assessment session entity — stores only metadata, never PHI.
//
// Why no PHI stored? HIPAA Safe Harbor de-identification. We store only:
// - FHIR patient ID (opaque reference, not a name or DOB)
// - Risk scores (numbers)
// - FHIR resource IDs (pointers to where we wrote on the FHIR server)
// - Timestamps
// All PHI stays in the FHIR server (MeldRx).
// Source: https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('assessment_sessions')
export class AssessmentSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  patientId!: string;

  @Column()
  fhirBaseUrl!: string;

  @Column({ nullable: true })
  plannedProcedure!: string;

  @Column('float', { nullable: true })
  rcriScore!: number | null;

  @Column('float', { nullable: true })
  ariscatScore!: number | null;

  @Column({ nullable: true })
  overallRisk!: string | null;

  @Column({ nullable: true })
  fhirRiskAssessmentId!: string | null;

  @Column({ nullable: true })
  fhirCarePlanId!: string | null;

  @Column({ default: 'pending' })
  status!: 'pending' | 'in_progress' | 'completed' | 'failed';

  @CreateDateColumn()
  createdAt!: Date;
}
