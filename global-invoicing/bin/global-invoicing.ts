#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import * as cache from '../src/scripts/load-cache';
import { configProps } from '../src/config/config';
import { Certificates, Parameters } from '../src/config/types';
import { StandardStage } from '../lib/standard-stage';
import { EuropeanStage } from '../lib/european-stage';

const config = configProps;
const certs: Certificates = cache.loadCachedCertificates('cdk.out/cache/certs.json');
const params: Parameters = cache.loadCachedParameters('cdk.out/cache/params.json');

const app = new cdk.App();

// Stage for aws-eusc partition
new EuropeanStage(app, 'European', {
  stackName: `${config.europe.prefix}-${config.europe.location}`.toLowerCase(),
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.europe.region ?? 'eusc-de-east-1',
  },
  caCertPem: certs.caCertPem,
  orgInfo: config.certs,
  events: config.events,
  countries: config.countries,
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
