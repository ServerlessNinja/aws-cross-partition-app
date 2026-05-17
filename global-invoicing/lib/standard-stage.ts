import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { configProps } from '../src/config/config';
import { Parameters } from '../src/config/types';
import { loadParameters } from '../src/scripts/load-cache';
import { LondonStack } from './london-stack';

export class StandardStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    const cfg = configProps;
    const params: Parameters = loadParameters(`${cfg.cache}/params.json`);

    // Stack(s) for aws partition
    new LondonStack(this, 'LondonStack', {
      prefix: cfg.standard.prefix,
      events: cfg.events,
      europeanProps: {
        prefix: cfg.european.prefix,
        region: cfg.european.region,
        raTrustAnchorArn: params.rolesAnywhere.trustAnchorArn,
        raProfileArn: params.rolesAnywhere.profileArn,
        raRoleArn: params.rolesAnywhere.roleArn,
      },
      euCountries: cfg.countries
    });

  }
}