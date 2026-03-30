import type { FhirCarePlan, FhirGoal } from '@preop-intel/shared';

// Builds FHIR R4 CarePlan + Goal resources.
// Why create Goals as separate resources? FHIR requires Goal to be its own
// resource. CarePlan references Goals by ID. We create Goals first, get their
// server-assigned IDs, then set carePlan.goal[].
// Source: https://www.hl7.org/fhir/R4/careplan.html#CarePlan.goal

export interface CarePlanInput {
  patientId: string;
  goals: Array<{
    description: string;
    target: string;
    timeframe: string;
  }>;
  activities: string[];
}

export class CarePlanBuilder {
  static build(input: CarePlanInput): { carePlan: FhirCarePlan; goals: FhirGoal[] } {
    const goals: FhirGoal[] = input.goals.map(g => ({
      resourceType: 'Goal',
      lifecycleStatus: 'active',
      description: { text: g.description },
      subject: { reference: `Patient/${input.patientId}` },
      target: [{
        detailQuantity: {
          // Store target as text since targets vary (%, mL/min, etc.)
          unit: g.target,
        },
        dueDate: calculateDueDate(g.timeframe),
      }],
    }));

    const carePlan: FhirCarePlan = {
      resourceType: 'CarePlan',
      status: 'active',
      intent: 'plan',
      title: 'Pre-operative Optimization Plan',
      subject: { reference: `Patient/${input.patientId}` },
      period: {
        start: new Date().toISOString().split('T')[0],
        end: calculateDueDate(input.goals[0]?.timeframe ?? '6 weeks'),
      },
      // goal[] will be populated after Goals are created on the FHIR server
      goal: [],
      activity: input.activities.map(desc => ({
        detail: {
          status: 'not-started' as const,
          description: desc,
        },
      })),
    };

    return { carePlan, goals };
  }
}

/** Convert timeframe string like "6 weeks" to an ISO date string */
function calculateDueDate(timeframe: string): string {
  const now = new Date();
  const match = timeframe.match(/(\d+)\s*(week|month|day)/i);
  if (match) {
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('week')) now.setDate(now.getDate() + amount * 7);
    else if (unit.startsWith('month')) now.setMonth(now.getMonth() + amount);
    else if (unit.startsWith('day')) now.setDate(now.getDate() + amount);
  } else {
    // Default: 6 weeks from now
    now.setDate(now.getDate() + 42);
  }
  return now.toISOString().split('T')[0];
}
