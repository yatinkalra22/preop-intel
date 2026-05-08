// Lightweight rate limit + structured request log for the public A2A v1 server.
//
// Once the agent-card URL is registered with Po, anyone with the URL can probe
// the endpoint. Even a 401/403 response wastes CPU and feeds noise into logs,
// so we cap traffic per (X-API-Key prefix or IP) bucket and emit a one-line
// JSON log for every non-card request.

import type { Request, Response, NextFunction } from 'express';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const DEFAULT_LIMIT_PER_MIN = 60;

function limitPerMin(): number {
  const v = Number(process.env.A2A_RATE_LIMIT_PER_MIN);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_LIMIT_PER_MIN;
}

// Bypass: agent card + health are public + rate-limit-free so Po liveness
// pings and the registration handshake never get throttled.
function isBypass(req: Request): boolean {
  return (
    req.path === `/${AGENT_CARD_PATH}`
    || req.path.endsWith('/agent-card.json')
    || (req.method === 'GET' && req.path === '/health')
  );
}

function bucketKeyFor(req: Request): string {
  const raw = req.headers['x-api-key'];
  const apiKey = Array.isArray(raw) ? raw[0] : raw;
  if (typeof apiKey === 'string' && apiKey.length >= 6) {
    return `key:${apiKey.slice(0, 6)}`;
  }
  // Fall back to IP. Express respects trust proxy for x-forwarded-for.
  return `ip:${req.ip ?? 'unknown'}`;
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isBypass(req)) {
    next();
    return;
  }

  const now = Date.now();
  const key = bucketKeyFor(req);
  const limit = limitPerMin();

  // Opportunistic prune: drop expired buckets while we're here. Cheap and
  // bounds memory under sustained-but-not-spiky load.
  if (buckets.size > 1024) {
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
  }

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      jsonrpc: '2.0',
      error: { code: -32029, message: 'Too many requests' },
      id: null,
    });
    return;
  }

  next();
}

export function requestLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isBypass(req)) {
    next();
    return;
  }

  const startedAt = Date.now();
  const raw = req.headers['x-api-key'];
  const apiKey = Array.isArray(raw) ? raw[0] : raw;
  const keyPrefix = typeof apiKey === 'string' && apiKey.length >= 6 ? apiKey.slice(0, 6) : null;

  res.on('finish', () => {
    // Single-line JSON so it's parseable in CloudWatch / fly logs / vercel.
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs: Date.now() - startedAt,
      keyPrefix,
      ip: req.ip,
    });
    if (res.statusCode >= 500) console.error(line);
    else if (res.statusCode >= 400) console.warn(line);
    else console.log(line);
  });

  next();
}
