import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { LondonStack } from './london-stack';
import { configProps } from '../src/config/config';

export class StandardStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    const cfg = configProps;

    // Stack(s) for aws partition
    new LondonStack(this, 'LondonStack');

  }
}