#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { configProps } from '../src/config/config';
import { StandardStage } from '../lib/standard-stage';
import { EuropeanStage } from '../lib/european-stage';

const config = configProps;
const app = new cdk.App();

// Stage for aws-eusc partition
new EuropeanStage(app, 'European', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.europe.region ?? 'eusc-de-east-1',
  },
});

// Stage for aws partition
new StandardStage(app, 'Standard', {
  stackName: `${config.global.prefix}-${config.global.location}`.toLowerCase(),
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.global.region ?? 'eu-west-2',
  },
  prefix: config.global.prefix,
  events: config.events,
  euCountries: config.countries,
  europeanProps: {
    prefix: config.europe.prefix,
    region: config.europe.region,
    raTrustAnchorArn: params.rolesAnywhere.trustAnchorArn,
    raProfileArn: params.rolesAnywhere.profileArn,
    raRoleArn: params.rolesAnywhere.roleArn,
  },
});
