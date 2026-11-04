#!/usr/bin/env bash
#
# Interactive deployment of the cross-partition (Standard and EUSC) CDK app.
# Automates the manual steps from README.md, pausing before each step.
#
# Profile names and regions must match global-invoicing/src/config/config.ts
# and the "config.profile" section of global-invoicing/package.json.

# AWS CLI profiles and regions
STANDARD_PROFILE="standard"
STANDARD_REGION="eu-west-2"
EUROPEAN_PROFILE="european"
EUROPEAN_REGION="eusc-de-east-1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/global-invoicing"

step() {
  echo
  echo "=== $1 ==="
  read -r -p "Press Enter to continue..."
}

# ---------------------------------------------------------------------------
# Prerequisites
#
# Configure AWS CLI profiles for authentication with AWS IAM Identity Center
# (SSO) instances on both AWS partitions.
# For more details refer to:
# https://docs.aws.eu/cli/latest/userguide/cli-configure-sso.html
#
# This AWS CDK project relies on AWS CLI profiles named `standard` and
# `european`.
# ---------------------------------------------------------------------------
step "Check AWS CLI profiles: ${STANDARD_PROFILE}, ${EUROPEAN_PROFILE}"

PROFILES="$(aws configure list-profiles)"
for PROFILE in "$STANDARD_PROFILE" "$EUROPEAN_PROFILE"; do
  if ! grep -qx "$PROFILE" <<< "$PROFILES"; then
    echo "AWS CLI profile '${PROFILE}' not found in AWS CLI config."
    exit 1
  fi
  echo "Profile '${PROFILE}' found."
done

# ---------------------------------------------------------------------------
# Authenticate to your AWS accounts on both AWS partitions:
#   aws sso login --profile standard
#   aws sso login --profile european
#
# Verify authentication works for both profiles:
#   aws sts get-caller-identity --profile standard
#   aws sts get-caller-identity --profile european
# ---------------------------------------------------------------------------
step "Verify authentication for both profiles"

if ! STANDARD_ACCOUNT="$(aws sts get-caller-identity --profile "$STANDARD_PROFILE" --query Account --output text)"; then
  echo "Authentication failed for profile '${STANDARD_PROFILE}'. Run: aws sso login --profile ${STANDARD_PROFILE}"
  exit 1
fi

if ! EUROPEAN_ACCOUNT="$(aws sts get-caller-identity --profile "$EUROPEAN_PROFILE" --query Account --output text)"; then
  echo "Authentication failed for profile '${EUROPEAN_PROFILE}'. Run: aws sso login --profile ${EUROPEAN_PROFILE}"
  exit 1
fi

echo "Standard account (${STANDARD_PROFILE}): ${STANDARD_ACCOUNT}"
echo "European account (${EUROPEAN_PROFILE}): ${EUROPEAN_ACCOUNT}"

# ---------------------------------------------------------------------------
# 1. Install and build
#
# Install all required NPM packages and build the TypeScript project.
# ---------------------------------------------------------------------------
step "1. Install and build"

cd "$PROJECT_DIR" || exit 1
npm install
npm run build

# ---------------------------------------------------------------------------
# 2. Generate certificates
#
# Generate local self-signed certificates. Certificate files will be stored
# in `cdk.out/cache/` directory (git ignored). Existing certificates are not
# overwritten.
# ---------------------------------------------------------------------------
step "2. Generate certificates"

npm run certs:generate

# ---------------------------------------------------------------------------
# 3. Synthesize CDK application
#
# Synthesize all stacks & stages of the CDK application.
# ---------------------------------------------------------------------------
step "3. Synthesize CDK application"

npm run synth:all

# ---------------------------------------------------------------------------
# 4. Prepare CDK Toolkit
#
# Bootstrap CDK Toolkit to your target accounts & regions on both partitions.
# ---------------------------------------------------------------------------
step "4. Bootstrap CDK Toolkit (aws://${STANDARD_ACCOUNT}/${STANDARD_REGION}, aws://${EUROPEAN_ACCOUNT}/${EUROPEAN_REGION})"

# AWS Standard partition
npx cdk bootstrap "aws://${STANDARD_ACCOUNT}/${STANDARD_REGION}" --profile "$STANDARD_PROFILE"

# AWS EUSC partition
npx cdk bootstrap "aws://${EUROPEAN_ACCOUNT}/${EUROPEAN_REGION}" --profile "$EUROPEAN_PROFILE"

# ---------------------------------------------------------------------------
# 5. Deploy to EUSC partition
#
# Start deployment of CDK stage (single stack) on EUSC partition.
# `cdk deploy` blocks until the deployment finishes.
# ---------------------------------------------------------------------------
step "5. Deploy to EUSC partition"

npm run deploy:european -- --require-approval never

# ---------------------------------------------------------------------------
# 6. Get EUSC parameters
#
# Get SSM parameters' values from EUSC partition and synthesize the CDK
# stacks again. Parameters will be stored in `cdk.out/cache/params.json`
# file (git ignored).
# ---------------------------------------------------------------------------
step "6. Get EUSC parameters and synthesize again"

npm run params:get
npm run synth:all

# ---------------------------------------------------------------------------
# 7. Deploy to Standard partition
#
# Start deployment of CDK stage (single stack) on Standard partition.
# `cdk deploy` blocks until the deployment finishes.
# ---------------------------------------------------------------------------
step "7. Deploy to Standard partition"

npm run deploy:standard -- --require-approval never

# ---------------------------------------------------------------------------
# 8. Upload Certificates
#
# Save content of self-signed certificates in Secrets Manager on Standard
# partition.
# ---------------------------------------------------------------------------
step "8. Upload certificates"

npm run certs:upload

# ---------------------------------------------------------------------------
# 9. Seed database (optional)
#
# Seed DynamoDB tables with some mock items for `customers` and `invoices`.
# Press Ctrl+C at the prompt to skip.
# ---------------------------------------------------------------------------
step "9. Seed database (optional, Ctrl+C to skip)"

npm run seed:customers
npm run seed:invoices

echo
echo "Deployment complete."
