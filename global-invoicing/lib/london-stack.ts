import * as cdk from 'aws-cdk-lib/core';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as states from 'aws-cdk-lib/aws-stepfunctions';
import * as eventsources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from 'constructs';
import { StringListParameter } from 'aws-cdk-lib/aws-ssm';
import { EventBridgeConfig } from "../src/config/types";

interface LondonStackProps extends cdk.StackProps {
  prefix: string;
  events: {
    invoices: EventBridgeConfig;
    customers: EventBridgeConfig;
  };
  europeanProps: {
    prefix: string;
    region: string;
    raTrustAnchorArn: string;
    raProfileArn: string;
    raRoleArn: string;
  };
  euCountries: string[];
}

export class LondonStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LondonStackProps) {
    super(scope, id, props);

    const certSecret = new sm.Secret(this, "CertSecret", {
      secretName: `${props.prefix}/bridge-certificate`,
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({ certificate: null, privateKey: null }),
      ),
    });

    const eventBus = new events.EventBus(this, "EventBus", {
      eventBusName: `${props.prefix}-bus`,
      description: "Event bus for cross-partition invoicing bridge",
    });

    // Docs: https://docs.aws.amazon.com/rolesanywhere/latest/userguide/credential-helper.html
    // Binary: https://rolesanywhere.amazonaws.com/releases/1.8.1/Aarch64/Linux/Amzn2023/aws_signing_helper
    const helperLayer = new lambda.LayerVersion(this, 'SigningHelperLayer', {
      layerVersionName: 'aws_signing_helper',
      code: lambda.Code.fromAsset('src/layers/signing-helper'),
      compatibleArchitectures: [ lambda.Architecture.ARM_64 ],
      compatibleRuntimes: [ lambda.Runtime.PYTHON_3_14 ],
    });

    const eventsBridgeFn = new lambda.Function(this, "EventsBridgeFunction", {
      functionName: `${props.prefix}-events-bridge-fn`,
      runtime: lambda.Runtime.PYTHON_3_14,
      architecture: lambda.Architecture.ARM_64,
      handler: 'events-bridge.lambda_handler',
      code: lambda.Code.fromAsset("src/lambda/"),
      memorySize: 512,
      timeout: cdk.Duration.minutes(2),
      layers: [ helperLayer ],
      environment: {
        CERT_SECRET_ARN: certSecret.secretArn,
        RA_TRUST_ANCHOR_ARN: props.europeanProps.raTrustAnchorArn,
        RA_PROFILE_ARN: props.europeanProps.raProfileArn,
        RA_ROLE_ARN: props.europeanProps.raRoleArn,
        RA_REGION: props.europeanProps.region,
        EUSC_BUS_NAME: `${props.europeanProps.prefix}-bus`,
        EUSC_SOURCE: props.events.invoices.source,
        EUSC_DETAIL_TYPE: props.events.invoices.detailType,
      },
    });

    const streamsBridgeFn = new lambda.Function(this, "StreamsBridgeFunction", {
      functionName: `${props.prefix}-streams-bridge-fn`,
      runtime: lambda.Runtime.PYTHON_3_14,
      architecture: lambda.Architecture.ARM_64,
      handler: 'streams-bridge.lambda_handler',
      code: lambda.Code.fromAsset("src/lambda/"),
      memorySize: 512,
      timeout: cdk.Duration.minutes(2),
      layers: [ helperLayer ],
      environment: {
        CERT_SECRET_ARN: certSecret.secretArn,
        RA_TRUST_ANCHOR_ARN: props.europeanProps.raTrustAnchorArn,
        RA_PROFILE_ARN: props.europeanProps.raProfileArn,
        RA_ROLE_ARN: props.europeanProps.raRoleArn,
        RA_REGION: props.europeanProps.region,
        EUSC_BUS_NAME: `${props.europeanProps.prefix}-bus`,
        EUSC_SOURCE: props.events.customers.source,
        EUSC_DETAIL_TYPE: props.events.customers.detailType,
      },
    });

    certSecret.grantRead(eventsBridgeFn);
    certSecret.grantRead(streamsBridgeFn);

    const countriesParam = new StringListParameter(this, 'EuCountries', {
      parameterName: `/${props.prefix}/eu-countries`,
      stringListValue: props.euCountries,
    });

    const invoicesTable = new dynamodb.TableV2(this, "InvoicesTable", {
      tableName: `${props.prefix}-documents`,
      partitionKey: {
        name: "invoiceId",
        type: dynamodb.AttributeType.STRING
      },
      billing: dynamodb.Billing.onDemand(),
      encryption: dynamodb.TableEncryptionV2.awsManagedKey(),
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
        recoveryPeriodInDays: 30,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    const customersTable = new dynamodb.TableV2(this, "CustomersTable", {
      tableName: `${props.prefix}-customers`,
      partitionKey: {
        name: "customerId",
        type: dynamodb.AttributeType.STRING
      },
      billing: dynamodb.Billing.onDemand(),
      encryption: dynamodb.TableEncryptionV2.awsManagedKey(), 
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
        recoveryPeriodInDays: 30,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      dynamoStream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    streamsBridgeFn.addEventSource(
      new eventsources.DynamoEventSource(customersTable, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        maxBatchingWindow: cdk.Duration.seconds(0),
        batchSize: 10,
        retryAttempts: 3,
      })
    );

    customersTable.grantStreamRead(streamsBridgeFn);

    const stateMachine = new states.StateMachine(this, "InvoiceProcessingStateMachine", {
      stateMachineName: `${props.prefix}-save-documents`,
      stateMachineType: states.StateMachineType.STANDARD,
      definitionBody: states.DefinitionBody.fromFile('src/states/save-documents.asl.yaml'),
      definitionSubstitutions: {
        CountriesParameterName: countriesParam.parameterName,
        BridgeFunctionName: eventsBridgeFn.functionName,
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

    countriesParam.grantRead(stateMachine);
    invoicesTable.grantWriteData(stateMachine);
    eventsBridgeFn.grantInvoke(stateMachine);

    new events.Rule(this, "SaveDocsRule", {
      eventBus: eventBus,
      ruleName: `${props.prefix}-save-documents`,
      description: "Save incoming invoice documents",
      enabled: true,
      eventPattern: {
        source: [ props.events.invoices.source ],
        detailType: [ props.events.invoices.detailType ],
      },
      targets: [ 
        new targets.SfnStateMachine(stateMachine, {
          input: events.RuleTargetInput.fromEventPath("$.detail"),
        }),
        new targets.CloudWatchLogGroup(
          new logs.LogGroup(this, "EventRuleLogGroup", {
            logGroupName: `/aws/events/${props.prefix}-save-documents`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        ),
      ],
    });

  }
}
