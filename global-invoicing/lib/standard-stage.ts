import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { LondonStack } from './london-stack';

export class StandardStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    new LondonStack(this, 'LondonStack');

  }
}