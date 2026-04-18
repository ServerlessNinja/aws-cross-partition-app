import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { configProps } from '../src/config/config';
import { Certificates } from '../src/config/types';
import { loadCertificates } from '../src/scripts/load-cache';
import { BerlinStack } from './berlin-stack';

export class EuropeanStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    const cfg = configProps;
    const certs: Certificates = loadCertificates(`${cfg.cache}/certs.json`);

    // Stack(s) for aws-eusc partition
    new BerlinStack(this, 'BerlinStack', {
      prefix: cfg.european.prefix,
      caCertPem: certs.caCertPem,
      orgInfo: cfg.certs,
      events: cfg.events,
      countries: cfg.countries,
    });

  }
}