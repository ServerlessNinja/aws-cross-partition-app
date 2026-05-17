import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as iamra from 'aws-cdk-lib/aws-rolesanywhere';
import * as events from 'aws-cdk-lib/aws-events';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as states from 'aws-cdk-lib/aws-stepfunctions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { OrganizationInfo } from '../src/config/types';
import { EventBridgeConfig } from '../src/config/types';

interface BerlinStackStackProps extends cdk.StackProps {
  prefix: string;
  caCertPem: string;
  orgInfo: OrganizationInfo;
  countries: string[];
  events: {
    invoices: EventBridgeConfig;
    customers: EventBridgeConfig;
  };
}

export class BerlinStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BerlinStackStackProps) {
    super(scope, id, props);

    const eventBus = new events.EventBus(this, "EventBus", {
      eventBusName: `${props.prefix}-bus`,
      description: "Event bus for cross-partition invoicing bridge",
    });

    const trustAnchor = new iamra.CfnTrustAnchor(this, "TrustAnchor", {
      name: `${props.prefix}-ra-trust-anchor`,
      enabled: true,
      source: {
        sourceType: "CERTIFICATE_BUNDLE",
        sourceData: {
          x509CertificateData: props.caCertPem,
        },
      },
    });

    const crossPartitionRole = new iam.Role(this, "CrossPartitionRole", {
      roleName: `${props.prefix}-ra-role`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.PrincipalWithConditions(
        new iam.ServicePrincipal("rolesanywhere.amazonaws.com"),
        {
          StringEquals: {
            "aws:PrincipalTag/x509Subject/O": props.orgInfo.organization,
            "aws:PrincipalTag/x509Subject/OU": props.orgInfo.organizationalUnit,
            "aws:PrincipalTag/x509Subject/CN": props.orgInfo.commonName,
          }
        }
      ),
    });

    crossPartitionRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("rolesanywhere.amazonaws.com")],
        actions: [ "sts:TagSession", "sts:SetSourceIdentity" ],
      })
    );

    crossPartitionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [ "events:PutEvents" ],
        resources: [ eventBus.eventBusArn ],
      })
    );

    const profile = new iamra.CfnProfile(this, "Profile", {
      name: `${props.prefix}-ra-profile`,
      enabled: true,
      roleArns: [ crossPartitionRole.roleArn ],
      acceptRoleSessionName: true,
    });

    const invoicesTable = new dynamodb.Table(this, "InvoicesTable", {
      tableName: `${props.prefix}-documents`,
      partitionKey: {
        name: "invoiceId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "country",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,   
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
        recoveryPeriodInDays: 30,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    const customersTable = new dynamodb.Table(this, "CustomersTable", {
      tableName: `${props.prefix}-customers`,
      partitionKey: {
        name: "customerId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "country",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,   
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
        recoveryPeriodInDays: 30,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    const invoicesWorkflow = new states.StateMachine(this, "InvoiceProcessingStateMachine", {
      stateMachineName: `${props.prefix}-save-documents`,
      stateMachineType: states.StateMachineType.STANDARD,
      definitionBody: states.DefinitionBody.fromFile('src/states/save-documents-eu.asl.yaml'),
      definitionSubstitutions: {
        AwsPartition: this.partition,
        InvoicesTableName: invoicesTable.tableName,
      },
      logs: {
        level: states.LogLevel.ALL,
        destination: new logs.LogGroup(this, "StateMachineLogGroup", {
          logGroupName: `${props.prefix}-save-documents`,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      },
    });

    invoicesTable.grantWriteData(invoicesWorkflow);

    const customersWorkflow = new states.StateMachine(this, "CustomerProcessingStateMachine", {
      stateMachineName: `${props.prefix}-save-customers`,
      stateMachineType: states.StateMachineType.STANDARD,
      definitionBody: states.DefinitionBody.fromFile('src/states/save-customers-eu.asl.yaml'),
      definitionSubstitutions: {
        AwsPartition: this.partition,
        CustomersTableName: customersTable.tableName,
      },
      logs: {
        level: states.LogLevel.ALL,
        destination: new logs.LogGroup(this, "StateMachineLogGroup2", {
          logGroupName: `${props.prefix}-save-customers`,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      },
    });

    customersTable.grantWriteData(customersWorkflow);

    new events.Rule(this, "EventRule", {
      ruleName: `${props.prefix}-save-documents`,
      description: "Trigger processing of European invoices",
      eventBus: eventBus,
      eventPattern: {
        source: [ props.events.invoices.source ],
        detailType: [ props.events.invoices.detailType ],
        detail: {
          customer: {
            country: props.countries,
          }
        },
      },
      targets: [
        new targets.SfnStateMachine(invoicesWorkflow, {
          input: events.RuleTargetInput.fromEventPath("$.detail"),
        }),
        new targets.CloudWatchLogGroup(
          new logs.LogGroup(this, "EventRuleLogGroup", {
            logGroupName: `/aws/events/${props.prefix}-save-invoices`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        ),
      ]
    });

    new events.Rule(this, "EventRule2", {
      ruleName: `${props.prefix}-save-customers`,
      description: "Trigger processing of European customers",
      eventBus: eventBus,
      eventPattern: {
        source: [ props.events.customers.source ],
        detailType: [ props.events.customers.detailType ],
      },
      targets: [
        new targets.SfnStateMachine(customersWorkflow, {
          input: events.RuleTargetInput.fromEventPath("$.detail"),
        }),
        new targets.CloudWatchLogGroup(
          new logs.LogGroup(this, "EventRuleLogGroup2", {
            logGroupName: `/aws/events/${props.prefix}-save-customers`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        ),
      ]
    });

    new StringParameter(this, "TrustAnchorArnParam", {
      parameterName: `/${props.prefix}/ra-trust-anchor-arn`,
      stringValue: trustAnchor.attrTrustAnchorArn,
    });

    new StringParameter(this, "ProfileArnParam", {
      parameterName: `/${props.prefix}/ra-profile-arn`,
      stringValue: profile.attrProfileArn,
    });

    new StringParameter(this, "RoleArnParam", {
      parameterName: `/${props.prefix}/ra-role-arn`,
      stringValue: crossPartitionRole.roleArn,
    });

    new cdk.CfnOutput(this, 'TrustAnchorArn', { value: trustAnchor.attrTrustAnchorArn });
    new cdk.CfnOutput(this, 'ProfileArn', { value: profile.attrProfileArn });
    new cdk.CfnOutput(this, 'RoleArn', { value: crossPartitionRole.roleArn });

  }
}
