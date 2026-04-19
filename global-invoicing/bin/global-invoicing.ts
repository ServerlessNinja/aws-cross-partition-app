#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { configProps } from '../src/config/config';
import { StandardStage } from '../lib/standard-stage';
import { EuropeanStage } from '../lib/european-stage';

const cfg = configProps;
const app = new cdk.App();

// Stage for aws-eusc partition
new EuropeanStage(app, 'European', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: cfg.european.region ?? 'eusc-de-east-1',
  },
});

// Stage for aws partition
new StandardStage(app, 'Standard', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: cfg.standard.region ?? 'eu-west-2',
  },
});
