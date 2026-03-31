#!/usr/bin/env bash
# Manual deployment script for PreOp Intel.
# Usage: ./scripts/deploy.sh [stage]
#   stage: dev (default) | prod
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - SSM parameters set (see setup guide)
#   - Vercel CLI installed (npm i -g vercel)

set -euo pipefail

STAGE="${1:-dev}"
echo "Deploying PreOp Intel — stage: $STAGE"

# 1. Build everything
echo "Building all packages..."
npx turbo run build

# 2. Deploy backend to Lambda
echo "Deploying backend to AWS Lambda..."
cd apps/backend
npx serverless deploy --stage "$STAGE"
BACKEND_URL=$(npx serverless info --stage "$STAGE" 2>/dev/null | grep -o 'https://[^ ]*' | head -1)
echo "Backend URL: $BACKEND_URL"
cd ../..

# 3. Deploy MCP server to Lambda
echo "Deploying MCP server to AWS Lambda..."
cd apps/mcp-server
npx serverless deploy --stage "$STAGE"
MCP_URL=$(npx serverless info --stage "$STAGE" 2>/dev/null | grep -o 'https://[^ ]*' | head -1)
echo "MCP URL: $MCP_URL"
cd ../..

# 4. Deploy frontend to Vercel
echo "Deploying frontend to Vercel..."
cd apps/frontend
if [ "$STAGE" = "prod" ]; then
  vercel --prod
else
  vercel
fi
cd ../..

echo ""
echo "Deployment complete!"
echo "  Backend:  $BACKEND_URL"
echo "  MCP:      $MCP_URL"
echo "  Frontend: Check Vercel dashboard for URL"
