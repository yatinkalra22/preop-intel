// Factory that builds a Po-compliant A2A v1 Express app for the PreOp Intel
// orchestrator. Mirrors po-adk-typescript/shared/appFactory.ts but without
// the ADK runner — we run a deterministic executor instead.

import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
} from '@a2a-js/sdk/server';
import {
  agentCardHandler,
  jsonRpcHandler,
  UserBuilder,
} from '@a2a-js/sdk/server/express';
import { buildOrchestratorAgentCard } from './agent-card';
import { PreOpRiskExecutor } from './executor';
import { apiKeyMiddleware } from './middleware';
import { rateLimitMiddleware, requestLogMiddleware } from './observability';

export interface CreateA2aAppOptions {
  url: string;
  fhirExtensionUri: string;
  requireApiKey?: boolean;
}

export function createA2aApp(options: CreateA2aAppOptions): Application {
  const { url, fhirExtensionUri, requireApiKey = true } = options;

  const agentCard = buildOrchestratorAgentCard({ url, fhirExtensionUri, requireApiKey });
  const executor = new PreOpRiskExecutor();
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    new InMemoryTaskStore(),
    executor,
  );

  const app = express();
  // Trust the platform's reverse proxy (Fly / Render / API Gateway / nginx)
  // so req.ip and X-Forwarded-For drive the rate-limit bucket key.
  app.set('trust proxy', true);
  app.use(express.json({ limit: '10mb' }));
  app.use(requestLogMiddleware);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', server: 'preop-intel-a2a-orchestrator' });
  });

  app.use(
    `/${AGENT_CARD_PATH}`,
    agentCardHandler({ agentCardProvider: requestHandler }),
  );

  // Rate-limit before auth so we don't even validate the key on flooded buckets.
  app.use('/', rateLimitMiddleware);

  if (requireApiKey) {
    app.use('/', (req: Request, res: Response, next: NextFunction) => {
      apiKeyMiddleware(req, res, next);
    });
  }

  app.use(
    '/',
    jsonRpcHandler({
      requestHandler,
      userBuilder: UserBuilder.noAuthentication,
    }),
  );

  return app;
}
