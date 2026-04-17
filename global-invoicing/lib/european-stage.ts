import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { configProps } from '../src/config/config';
import { Certificates, Parameters } from '../src/config/types';
import { loadCertificates, loadParameters } from '../src/scripts/load-cache';
import { BerlinStack } from './berlin-stack';

const config = configProps;
const certs: Certificates = loadCertificates(`${config.cache}/certs.json`);
const params: Parameters = loadParameters('${config.cache}/params.json');

export class EuropeanStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    // Stack(s) for aws-eusc partition
    new BerlinStack(this, 'BerlinStack', {
      stackName: `${config.europe.prefix}-${config.europe.location}`.toLowerCase(),
      caCertPem: certs.caCertPem,
      orgInfo: config.certs,
      events: config.events,
      countries: config.countries,
    });

  }
}