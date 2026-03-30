import { Controller, Post, Body } from '@nestjs/common';
import { RiskService } from './risk.service';
import type { RcriInput, AriscatInput } from '@preop-intel/shared';

@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Post('rcri')
  calculateRcri(@Body() body: RcriInput) {
    return this.riskService.calculateRcri(body);
  }

  @Post('ariscat')
  calculateAriscat(@Body() body: AriscatInput) {
    return this.riskService.calculateAriscat(body);
  }
}
