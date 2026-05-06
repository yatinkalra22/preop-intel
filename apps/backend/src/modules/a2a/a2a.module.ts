import { Module } from '@nestjs/common';
import { A2AController } from './a2a.controller';
import { A2AHandlersService } from './a2a-handlers.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  controllers: [A2AController],
  providers: [A2AHandlersService],
})
export class A2AModule {}
