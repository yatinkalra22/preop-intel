import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';

function getAllowedOrigins(): string[] {
  const configured = process.env.FRONTEND_URL?.split(',').map((x) => x.trim()).filter(Boolean) ?? [];
  if (configured.length > 0) return configured;
  return ['http://localhost:3000'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const httpAdapter = app.getHttpAdapter();
  (httpAdapter.getInstance() as any).disable?.('x-powered-by');

  // Lightweight security headers for API responses.
  app.use((_: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  const allowedOrigins = getAllowedOrigins();
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`PreOp Intel API running on :${port}`);
}
bootstrap();
