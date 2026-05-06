// HTTP endpoints exposing each agent over A2A.

import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { A2AHandlersService } from './a2a-handlers.service';
import { buildAgentCards } from './a2a-cards';
import type {
  A2AAgentCard,
  A2AAgentName,
  A2ATaskRequest,
  A2ATaskResponse,
} from './a2a.types';

const VALID_AGENTS: A2AAgentName[] = ['note-extractor', 'cardiac', 'pulmonary', 'metabolic', 'orchestrator'];

@Controller('a2a')
export class A2AController {
  constructor(private readonly handlers: A2AHandlersService) {}

  @Get('agents')
  listAgents(): { agents: A2AAgentCard[] } {
    const cards = buildAgentCards(this.baseUrl());
    return { agents: Object.values(cards) };
  }

  @Get('agents/:name/.well-known/agent.json')
  agentCard(@Param('name') name: string): A2AAgentCard {
    if (!VALID_AGENTS.includes(name as A2AAgentName)) {
      throw new NotFoundException(`Unknown agent: ${name}`);
    }
    return buildAgentCards(this.baseUrl())[name as A2AAgentName];
  }

  @Post('agents/:name/tasks')
  async runTask(
    @Param('name') name: string,
    @Body() req: Partial<A2ATaskRequest>,
  ): Promise<A2ATaskResponse> {
    if (!VALID_AGENTS.includes(name as A2AAgentName)) {
      throw new NotFoundException(`Unknown agent: ${name}`);
    }

    const taskId = req.taskId ?? randomUUID();
    const startedAt = new Date();

    try {
      const artifact = await this.dispatch(name as A2AAgentName, req.input);
      const completedAt = new Date();
      return {
        taskId,
        agentName: name as A2AAgentName,
        status: 'completed',
        artifact,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      };
    } catch (err) {
      const completedAt = new Date();
      return {
        taskId,
        agentName: name as A2AAgentName,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      };
    }
  }

  private async dispatch(name: A2AAgentName, input: unknown): Promise<unknown> {
    switch (name) {
      case 'note-extractor': return this.handlers.handleNoteExtractor(input);
      case 'cardiac':        return this.handlers.handleCardiac(input);
      case 'pulmonary':      return this.handlers.handlePulmonary(input);
      case 'metabolic':      return this.handlers.handleMetabolic(input);
      case 'orchestrator':   return this.handlers.handleOrchestrator(input);
    }
  }

  private baseUrl(): string {
    return process.env.A2A_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3001'}`;
  }
}
