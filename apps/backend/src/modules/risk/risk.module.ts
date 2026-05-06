import { Module } from '@nestjs/common';
import { RiskService } from './risk.service';
import { RiskController } from './risk.controller';
import { CancellationService } from './cancellation.service';

@Module({
  controllers: [RiskController],
  providers: [RiskService, CancellationService],
  exports: [RiskService, CancellationService],
})
export class RiskModule {}
