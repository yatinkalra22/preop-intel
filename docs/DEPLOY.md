# Deployment

PreOp Intel deploys to:

- **Backend (NestJS)** → AWS Lambda via Serverless Framework
- **MCP server** → AWS Lambda via Serverless Framework
- **Frontend (Next.js)** → Vercel

This split is intentional: NestJS needs VPC access (RDS, ElastiCache) and a 30s timeout that exceeds Vercel Hobby's 10s limit, while Next.js is a first-class Vercel framework.

## Prerequisites

- AWS account with permissions for Lambda, API Gateway, SSM, RDS, ElastiCache, IAM
- AWS CLI configured (`aws configure`)
- Vercel account + Vercel CLI (`npm i -g vercel`)
- Provisioned RDS Postgres instance and ElastiCache Redis cluster (free tier `db.t3.micro` / `cache.t3.micro` is sufficient)
- Anthropic API key
- MeldRx workspace credentials (if running live FHIR mode)

## 1. Provision SSM parameters

Secrets are stored in AWS SSM Parameter Store, encrypted at rest with KMS. Serverless Framework resolves them at deploy time via `${ssm:/path}`.

Run the provisioning script:

```bash
./scripts/setup-ssm.sh prod
```

It prompts for each value and writes parameters under `/preop-intel/<stage>/`:

| Parameter | Source |
|---|---|
| `/preop-intel/<stage>/DATABASE_URL` | RDS connection string |
| `/preop-intel/<stage>/REDIS_URL` | ElastiCache endpoint |
| `/preop-intel/<stage>/ANTHROPIC_API_KEY` | Anthropic dashboard |
| `/preop-intel/<stage>/FHIR_BASE_URL` | MeldRx workspace URL |
| `/preop-intel/<stage>/FHIR_CLIENT_ID` | MeldRx app credentials |
| `/preop-intel/<stage>/FHIR_CLIENT_SECRET` | MeldRx app credentials |
| `/preop-intel/<stage>/FRONTEND_URL` | Vercel URL (set after first frontend deploy) |

## 2. Deploy backend + MCP server

```bash
./scripts/deploy.sh prod
```

This script runs sequentially:

1. `npx turbo run build` — builds all workspaces
2. `cd apps/backend && npx serverless deploy --stage prod` — deploys NestJS
3. `cd apps/mcp-server && npx serverless deploy --stage prod` — deploys MCP server
4. `cd apps/frontend && vercel --prod` — deploys frontend

Capture the URLs printed by each step:

- Backend API URL — `https://<id>.execute-api.<region>.amazonaws.com/prod/api`
- MCP server URL — `https://<id>.execute-api.<region>.amazonaws.com/prod/mcp`
- Frontend URL — `https://<project>.vercel.app`

## 3. Configure Vercel environment

After the first frontend deploy, set Vercel env vars in the dashboard or via CLI:

```bash
cd apps/frontend
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://<backend-url>/api

vercel env add NEXT_PUBLIC_SMART_CLIENT_ID production
vercel env add NEXT_PUBLIC_SMART_REDIRECT_URI production
# Enter: https://<frontend-url>/callback

vercel env add NEXT_PUBLIC_DEMO_MODE production
# Enter: true (or false for live mode)
```

Then redeploy:

```bash
vercel --prod
```

## 4. Update CORS

Set the deployed frontend URL into SSM so the backend allows it:

```bash
aws ssm put-parameter \
  --name /preop-intel/prod/FRONTEND_URL \
  --value https://<your-frontend>.vercel.app \
  --type String \
  --overwrite
```

Redeploy the backend so the new value takes effect:

```bash
cd apps/backend && npx serverless deploy --stage prod
```

## 5. Verify

```bash
# Backend
curl https://<backend-url>/api/health

# MCP server
curl https://<mcp-url>/health
# Expect: {"status":"ok","server":"preop-intel-mcp","tools":12}

# A2A agents
curl https://<backend-url>/a2a/agents
# Expect: { "agents": [ ... 5 cards ... ] }

# Frontend (open in browser)
open https://<frontend-url>
```

## 6. Seed live FHIR (optional)

If you want live mode to find clinical notes for the demo patient, populate them on MeldRx:

```bash
FHIR_BASE_URL=https://app.meldrx.com/api/fhir/<workspace> \
FHIR_ACCESS_TOKEN=<bearer> \
node scripts/seed-meldrx-notes.mjs
```

The script is idempotent — re-runs use FHIR `If-None-Exist` to avoid duplicates.

## Cost estimate

Free tier covers most of the stack. Operational cost on a quiet account:

| Resource | Estimated monthly |
|---|---|
| Lambda (backend + MCP, ~50 invocations/day) | < $0.10 |
| RDS `db.t3.micro` (free tier 12 months) | $0 |
| ElastiCache `cache.t3.micro` (free tier 12 months) | $0 |
| API Gateway (~50 req/day) | < $0.05 |
| SSM Parameter Store | $0 |
| Vercel Hobby | $0 |
| Anthropic API (~50 assessments) | ~$0.50 |
| **Total** | **~$0.65/month** |

## Rollback

To roll back to a previous version:

```bash
cd apps/backend && npx serverless rollback --timestamp <timestamp>
cd apps/mcp-server && npx serverless rollback --timestamp <timestamp>
cd apps/frontend && vercel rollback
```

`npx serverless deploy list` shows available timestamps.

## Teardown

```bash
cd apps/backend && npx serverless remove --stage prod
cd apps/mcp-server && npx serverless remove --stage prod
cd apps/frontend && vercel remove <project> --yes
aws ssm delete-parameters-by-path --path /preop-intel/prod
```

You'll also need to manually destroy the RDS instance and ElastiCache cluster from the AWS console.
