import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FhirModule } from './modules/fhir/fhir.module';
import { RiskModule } from './modules/risk/risk.module';
import { AuthModule } from './modules/auth/auth.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { DatabaseModule } from './modules/database/database.module';
import { AiModule } from './modules/ai/ai.module';
import { AgentsModule } from './modules/agents/agents.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    // Why ConfigModule.forRoot? Loads .env automatically and makes process.env
    // available via ConfigService with type safety.
    // Source: https://docs.nestjs.com/techniques/configuration
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    FhirModule,
    RiskModule,
    AssessmentModule,
    AiModule,
    AgentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
