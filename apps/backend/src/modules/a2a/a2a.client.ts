// A2A client — HTTP invocation of registered agents.
//
// Used by AgentsService when A2A_MODE=live to call specialists over real HTTP
// rather than direct function calls. Even when the server endpoint is local,
// the request appears as live A2A traffic in DevTools. When PreOp Intel is
// published to Prompt Opinion's marketplace, the same client wiring works
// against remote agent endpoints.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { A2AAgentName, A2ATaskRequest, A2ATaskResponse } from './a2a.types';

@Injectable()
export class A2AClient {
  private readonly logger = new Logger(A2AClient.name);
  private readonly baseUrl = process.env.A2A_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3001'}`;

  isLive(): boolean {
    return (process.env.A2A_MODE ?? 'local').toLowerCase() === 'live';
  }

  async invoke<T = unknown>(
    agentName: A2AAgentName,
    input: unknown,
    context?: A2ATaskRequest['context'],
  ): Promise<T> {
    const body: A2ATaskRequest = {
      taskId: randomUUID(),
      agentName,
      input,
      context,
    };

    const url = `${this.baseUrl}/a2a/agents/${agentName}/tasks`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`A2A call to ${agentName} failed: HTTP ${response.status}`);
    }

    const envelope = (await response.json()) as A2ATaskResponse<T>;

    if (envelope.status !== 'completed') {
      throw new Error(`A2A task ${envelope.taskId} failed: ${envelope.error ?? 'unknown'}`);
    }

    return envelope.artifact as T;
  }
}
