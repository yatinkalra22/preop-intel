import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitBucket>();

function getAllowedOrigins(): string[] {
  const configured = process.env.FRONTEND_URL?.split(',').map((x) => x.trim()).filter(Boolean) ?? [];
  if (configured.length > 0) return configured;
  return ['http://localhost:3000'];
}

function validateStartupConfig() {
  const smartAuthEnabled = process.env.DISABLE_SMART_AUTH !== 'true';
  const aiEnabled = process.env.ENABLE_AI !== 'false';

  const missing: string[] = [];

  if (smartAuthEnabled) {
    if (!process.env.FHIR_CLIENT_ID) missing.push('FHIR_CLIENT_ID');
    if (!process.env.FHIR_CLIENT_SECRET) missing.push('FHIR_CLIENT_SECRET');
    if (!process.env.SMART_CALLBACK_URL) missing.push('SMART_CALLBACK_URL');
  }

  if (aiEnabled && !process.env.ANTHROPIC_API_KEY) {
    missing.push('ANTHROPIC_API_KEY');
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_AUTH_BYPASS === 'true') {
    throw new Error('ALLOW_INSECURE_AUTH_BYPASS=true is not allowed in production');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function applyRateLimit(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  const method = req.method;

  let limit = 0;
  let windowMs = 0;

  if (path.startsWith('/api/auth')) {
    limit = 30;
    windowMs = 5 * 60 * 1000;
  } else if (path === '/api/assessments/start' && method === 'POST') {
    limit = 20;
    windowMs = 5 * 60 * 1000;
  } else if (path.startsWith('/api/assessments/') && path.endsWith('/stream')) {
    limit = 60;
    windowMs = 60 * 1000;
  }

  if (limit === 0) {
    next();
    return;
  }

  const key = `${getClientIp(req)}:${method}:${path}`;
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec.toString());
    res.status(429).json({ error: 'Too many requests. Please retry later.' });
    return;
  }

  bucket.count += 1;
  rateLimitStore.set(key, bucket);
  next();
}

async function bootstrap() {
  validateStartupConfig();

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

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    (req as any).requestId = requestId;
    next();
  });

  app.use(applyRateLimit);

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
