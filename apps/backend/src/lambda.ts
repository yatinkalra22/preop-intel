// Lambda entry point for AWS deployment.
// Why cache the handler? Lambda reuses the execution environment across
// invocations. Caching the NestJS bootstrap avoids re-initializing on
// warm starts (~2s savings).
// Source: https://docs.nestjs.com/faq/serverless

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configure as serverlessExpress } from '@vendia/serverless-express';
import express from 'express';
import { AppModule } from './app.module';
import type { Handler } from 'aws-lambda';

let cachedHandler: Handler;

async function bootstrapServer(): Promise<Handler> {
  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn', 'log'] },
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });
  app.setGlobalPrefix('api');

  await app.init();
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (event, context, callback) => {
  cachedHandler = cachedHandler ?? await bootstrapServer();
  return cachedHandler(event, context, callback);
};
