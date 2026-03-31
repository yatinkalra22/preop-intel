#!/usr/bin/env bash
# Creates AWS SSM parameters for PreOp Intel secrets.
# Usage: ./scripts/setup-ssm.sh [stage]
#
# Why SSM (not .env on Lambda)? Encrypted at rest via KMS, auditable,
# Serverless Framework has native ${ssm:} resolution.
# Source: https://www.serverless.com/framework/docs/providers/aws/guide/variables#reference-variables-using-the-ssm-parameter-store

set -euo pipefail

STAGE="${1:-dev}"
PREFIX="/preop-intel/$STAGE"

echo "Setting SSM parameters for stage: $STAGE"
echo "Prefix: $PREFIX"
echo ""

# Source .env file if it exists
if [ -f apps/backend/.env ]; then
  echo "Reading values from apps/backend/.env..."
  source apps/backend/.env
else
  echo "No apps/backend/.env found. Please provide values interactively."
  read -rp "ANTHROPIC_API_KEY: " ANTHROPIC_API_KEY
  read -rp "DATABASE_URL: " DATABASE_URL
  read -rp "REDIS_URL: " REDIS_URL
  read -rp "FHIR_BASE_URL: " FHIR_BASE_URL
  read -rp "FHIR_CLIENT_ID: " FHIR_CLIENT_ID
  read -rp "FHIR_CLIENT_SECRET: " FHIR_CLIENT_SECRET
  read -rp "FRONTEND_URL: " FRONTEND_URL
fi

put_param() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "  SKIP $name (empty)"
    return
  fi
  aws ssm put-parameter \
    --name "$PREFIX/$name" \
    --value "$value" \
    --type SecureString \
    --overwrite \
    --no-cli-pager > /dev/null
  echo "  SET  $name"
}

put_param "ANTHROPIC_API_KEY" "${ANTHROPIC_API_KEY:-}"
put_param "DATABASE_URL" "${DATABASE_URL:-}"
put_param "REDIS_URL" "${REDIS_URL:-}"
put_param "FHIR_BASE_URL" "${FHIR_BASE_URL:-}"
put_param "FHIR_CLIENT_ID" "${FHIR_CLIENT_ID:-}"
put_param "FHIR_CLIENT_SECRET" "${FHIR_CLIENT_SECRET:-}"
put_param "FRONTEND_URL" "${FRONTEND_URL:-}"

echo ""
echo "Done. Verify with: aws ssm get-parameters-by-path --path $PREFIX --with-decryption"
