// X-API-Key middleware for the Po-compliant A2A v1 server.
// Modeled on po-adk-typescript/shared/middleware.ts.
//
// The agent-card endpoint must always be public (Po fetches it before
// authenticating). Every other request is rejected unless the X-API-Key
// header matches one of PO_AGENT_API_KEY_PRIMARY / PO_AGENT_API_KEY_SECONDARY.

import type { Request, Response, NextFunction } from 'express';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';

export const VALID_API_KEYS: Set<string> = new Set(
  [
    process.env.PO_AGENT_API_KEY_PRIMARY,
    process.env.PO_AGENT_API_KEY_SECONDARY,
  ].filter((k): k is string => typeof k === 'string' && k.length > 0),
);

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (
    req.path === `/${AGENT_CARD_PATH}`
    || req.path.endsWith('/agent-card.json')
    || (req.method === 'GET' && req.path === '/health')
  ) {
    next();
    return;
  }

  if (VALID_API_KEYS.size === 0) {
    res.status(503).json({
      error: 'Service Unavailable',
      detail: 'No API keys configured. Set PO_AGENT_API_KEY_PRIMARY in env.',
    });
    return;
  }

  const raw = req.headers['x-api-key'];
  const apiKey = Array.isArray(raw) ? raw[0] : raw;

  if (!apiKey) {
    res.status(401).json({ error: 'Unauthorized', detail: 'X-API-Key header is required' });
    return;
  }

  if (!VALID_API_KEYS.has(apiKey)) {
    res.status(403).json({ error: 'Forbidden', detail: 'Invalid API key' });
    return;
  }

  next();
}
