import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { OrganizationInfo } from '../src/config/types';
import { EventBridgeConfig } from '../src/config/types';


export class BerlinStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

  }
}
