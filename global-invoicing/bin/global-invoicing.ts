#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { StandardStage } from '../lib/standard-stage';
import { EuropeanStage } from '../lib/european-stage';

const app = new cdk.App();

new StandardStage(app, 'Standard', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eu-west-2'
  }
});

new EuropeanStage(app, 'European', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eusc-de-east-1'
  }
});
