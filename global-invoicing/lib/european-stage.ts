import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { BerlinStack } from './berlin-stack';

export class EuropeanStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    // Stack(s) for aws-eusc partition
    new BerlinStack(this, 'BerlinStack');

  }
}