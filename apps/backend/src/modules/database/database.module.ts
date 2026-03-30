// Why TypeORM over Prisma? TypeORM integrates natively with NestJS
// (@nestjs/typeorm). Prisma requires a separate schema file and generation
// step, adding complexity for a hackathon.
// Source: https://docs.nestjs.com/techniques/database

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AssessmentSession } from '../assessment/assessment.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL', 'postgresql://preop:password@localhost:5432/preop_intel'),
        entities: [AssessmentSession],
        // Why synchronize in dev? Auto-creates tables from entities.
        // NEVER use in production — use migrations instead.
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
