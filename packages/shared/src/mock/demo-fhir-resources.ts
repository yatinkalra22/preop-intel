// Demo FHIR R4 resources — what the orchestrator agent would write to the chart.
// These are realistic FHIR resources that demonstrate write capability to judges.

import { DEMO_PATIENT, DEMO_DATA } from './demo-data.js';

export const DEMO_FHIR_RESOURCES = {
  riskAssessment: {
    resourceType: 'RiskAssessment',
    id: 'preop-risk-demo-001',
    status: 'final',
    subject: { reference: `Patient/${DEMO_PATIENT.id}`, display: DEMO_PATIENT.name },
    occurrenceDateTime: new Date().toISOString(),
    method: {
      coding: [{
        system: 'http://preop-intel.com/methods',
        code: 'multi-agent-assessment',
        display: 'PreOp Intel Multi-Agent Risk Assessment',
      }],
    },
    prediction: [
      {
        outcome: { text: 'Major Adverse Cardiac Event (MACE)' },
        probabilityDecimal: 0.066,
        qualitativeRisk: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/risk-probability', code: 'moderate', display: 'Moderate' }] },
        rationale: 'RCRI score 2/6: ischemic heart disease + diabetes on insulin',
      },
      {
        outcome: { text: 'Postoperative Pulmonary Complication (PPC)' },
        probabilityDecimal: 0.016,
        qualitativeRisk: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/risk-probability', code: 'low', display: 'Low' }] },
        rationale: 'ARISCAT score 19: age 67, SpO2 96%',
      },
    ],
    basis: [
      { reference: 'Condition/ihd-001', display: 'Ischemic Heart Disease (I25.10)' },
      { reference: 'Condition/dm2-001', display: 'Type 2 Diabetes Mellitus (E11.9)' },
      { reference: 'Observation/hba1c-001', display: 'HbA1c 9.2%' },
      { reference: 'Observation/egfr-001', display: 'eGFR 55 mL/min' },
    ],
    mitigation: 'Surgery not recommended until glycemic optimization achieved. HbA1c 9.2% exceeds safe threshold of 8.5%. Cardiology clearance required for RCRI 2/6.',
  },

  carePlan: {
    resourceType: 'CarePlan',
    id: 'preop-care-plan-demo-001',
    status: 'active',
    intent: 'plan',
    title: 'Perioperative Optimization Plan — Right Total Hip Arthroplasty',
    subject: { reference: `Patient/${DEMO_PATIENT.id}`, display: DEMO_PATIENT.name },
    period: { start: new Date().toISOString().split('T')[0] },
    activity: [
      {
        detail: {
          status: 'not-started',
          description: 'Endocrinology referral for glycemic optimization — target HbA1c < 8.5%',
          scheduledString: 'Immediate',
        },
      },
      {
        detail: {
          status: 'not-started',
          description: 'Cardiology clearance — RCRI 2/6, 6.6% MACE risk',
          scheduledString: 'Within 2 weeks',
        },
      },
      {
        detail: {
          status: 'not-started',
          description: 'Pre-operative incentive spirometry training',
          scheduledString: 'Before surgery',
        },
      },
      {
        detail: {
          status: 'not-started',
          description: 'Reduce basal insulin dose by 50% evening before surgery',
          scheduledString: 'Day before surgery',
        },
      },
    ],
  },

  flag: {
    resourceType: 'Flag',
    id: 'preop-flag-demo-001',
    status: 'active',
    category: [{
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/flag-category', code: 'safety', display: 'Safety' }],
    }],
    code: { text: 'HIGH PERIOPERATIVE RISK — Poorly controlled DM (HbA1c 9.2%), Moderate cardiac risk (RCRI 2/6)' },
    subject: { reference: `Patient/${DEMO_PATIENT.id}`, display: DEMO_PATIENT.name },
    period: { start: new Date().toISOString().split('T')[0] },
  },

  serviceRequest: {
    resourceType: 'ServiceRequest',
    id: 'preop-referral-demo-001',
    status: 'active',
    intent: 'order',
    category: [{
      coding: [{ system: 'http://snomed.info/sct', code: '3457005', display: 'Patient referral' }],
    }],
    code: { text: 'Endocrinology consultation for perioperative glycemic optimization' },
    subject: { reference: `Patient/${DEMO_PATIENT.id}`, display: DEMO_PATIENT.name },
    reasonCode: [{ text: 'HbA1c 9.2% — exceeds safe surgical threshold of 8.5% for elective surgery' }],
    note: [{ text: 'Patient scheduled for right total hip arthroplasty. HbA1c must be < 8.5% before proceeding.' }],
  },
};
