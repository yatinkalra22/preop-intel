// Backend API client.
// Why raw fetch (not axios)? Fetch is built into browser + Node 18+.
// Axios adds 13kB for features we don't use (interceptors, transforms).
// TanStack Query handles caching and retries.

import type { StartAssessmentRequest, AssessmentResult } from '@preop-intel/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  startAssessment: (params: StartAssessmentRequest) =>
    request<{ id: string }>('/assessments/start', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getAssessment: (id: string) =>
    request<any>(`/assessments/${id}`),

  getPatientAssessments: (patientId: string) =>
    request<any[]>(`/assessments/patient/${patientId}`),

  /** SSE stream URL for agent status updates */
  getStreamUrl: (assessmentId: string) =>
    `${API_URL}/assessments/${assessmentId}/stream`,

  health: () =>
    request<{ status: string }>('/health'),
};
