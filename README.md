# Overview

AWS CDK TypeScript project: a demo serverless application running cross-partition (Standard and EUSC) for invoice processing.

## Prerequisites

Configure AWS CLI profiles for authentication with AWS IAM Identity Center (SSO) instances on both AWS partitions.
For more details refer to: https://docs.aws.eu/cli/latest/userguide/cli-configure-sso.html

Sample content of `~/.aws/config` file with 2 profiles:

```ini
[profile standard]
sso_session = aws
sso_account_id = 111122223333
sso_role_name = Developer
region = eu-west-2
output = json

[profile european]
sso_session = aws-eusc
sso_account_id = 444455556666
sso_role_name = Developer
region = eusc-de-east-1
output = json

[sso-session aws]
sso_region = us-east-1
sso_start_url = https://my-sso-portal.awsapps.com/start
sso_registration_scopes = sso:account:access

[sso-session aws-eusc]
sso_region = eusc-de-east-1
sso_start_url = https://ssoins-1234567890abcdef.eusc-de-east-1.portal.amazonaws.eu
sso_registration_scopes = sso:account:access
```

Authenticate to your AWS accounts on both AWS partitions:

```bash
aws sso login --profile standard
aws sso login --profile european
```

Verify authentication works for both profiles:

```bash
aws sts get-caller-identity --profile standard
aws sts get-caller-identity --profile european
```

This AWS CDK project relies on AWS CLI profiles named `standard` and `european`. If you decide to name your profiles differently, or use another regions for deployment, please update the [config.ts](global-invoicing/src/config/config.ts) and [package.json](global-invoicing/package.json) files accordingly:

```bash
# global-invoicing/src/config/config.ts
  ...
  standard: {
    partition: "aws",
    region: "eu-west-2",
    profile: "standard",
    ...
  },
  european: {
    partition: "aws-eusc",
    region: "eusc-de-east-1",
    profile: "european",
    ...
  },

# global-invoicing/package.json
  ...
  "config": {
    "profile": {
      "aws": "standard",
      "eusc": "european"
    }
  },
```

## Deploy

### 1. Install and build

Install all required NPM packages and build the TypeScript project:

```bash
cd global-invoicing/
npm install
npm run build
```

### 2. Generate certificates

Generate local self-signed certificates:

```bash
npm run certs:generate
```

Certificate files will be stored in `cdk.out/cache/` directory (git ignored).

### 3. Synthesize CDK application

Synthesize all stacks & stages of the CDK application:

```bash
npm run synth:all
```

### 4. Prepare CDK Toolkit

Bootstrap CDK Toolkit to your target accounts & regions. Make sure to update the `cdk bootstrap` commands with your valid AWS account IDs on both partitions:

```bash
# AWS EUSC partition
npx cdk bootstrap aws://111122223333/eusc-de-east-1 --profile european

# AWS Standard partition
npx cdk bootstrap aws://444455556666/eu-west-2 --profile standard
```

### 5. Deploy to EUSC partition

Start deployment of CDK stage (single stack) on EUSC partition:

```bash
npm run deploy:european
```

### 6. Get EUSC parameters

Get SSM parameters' values from EUSC partition and synthesize the CDK stacks again:

```bash
npm run params:get
npm run synth:all
```

Parameters will be stored in `cdk.out/cache/params.json` file (git ignored).

### 4. Deploy to Standard partition

Start deployment of CDK stage (single stack) on EUSC partition:

```bash
npm run deploy:standard
```

### 5. Upload Certificates

Save content of self-signed certificates in Secrets Manager on Standard partition:

```bash
npm run certs:upload
```

### 6. Seed database (optional)

Seed DynamoDB tables with some mock items for `customers` and `invoices`:

```bash
npm run seed:customers
npm run seed:invoices
```

## Destroy and clean-up

To remove all resources from your AWS accounts (`cdk destroy`) and clean generated files:

```bash
npm run destroy:standard
npm run destroy:european

npm run cache:clean
```
