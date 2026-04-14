#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { configProps } from '../src/config/config';
import { Certificates } from '../src/config/types';
import { loadCachedCertificates } from '../src/scripts/load-cache';
import { StandardStage } from '../lib/standard-stage';
import { EuropeanStage } from '../lib/european-stage';

const config = configProps.europe;
const certs: Certificates = loadCachedCertificates('cdk.out/cache/certs.json');

const app = new cdk.App();

// Stage for aws partition
new StandardStage(app, 'Standard', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eu-west-2'
  }
});

// Stage for aws-eusc partition
new EuropeanStage(app, 'European', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eusc-de-east-1'
  }
});
