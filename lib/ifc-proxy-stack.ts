import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Tags, Duration, RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2-alpha";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations-alpha";

export class IfcApiCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    Tags.of(this).add("Project", "IfcApi");
    Tags.of(this).add("Environment", "Dev");
    Tags.of(this).add("Owner", "Ivan");

    const vpc = new ec2.Vpc(this, "IfcVpc", {
      maxAzs: 2,
      natGateways: 1,
    });

    const cluster = new ecs.Cluster(this, "IfcCluster", {
      vpc,
    });

    const bucket = new s3.Bucket(this, "IfcBucket", {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      enforceSSL: true,
    });

    const taskRole = new iam.Role(this, "IfcTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    bucket.grantReadWrite(taskRole);

    const apiTaskDef = new ecs.FargateTaskDefinition(this, "IfcApiTaskDef", {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole,
    });

    const container = apiTaskDef.addContainer("IfcApi", {
      image: ecs.ContainerImage.fromAsset("../path-to-your-docker-context"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "ifcapi" }),
      portMappings: [{ containerPort: 8069 }],
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });

    const apiService = new ecs.FargateService(this, "IfcApiService", {
      cluster,
      taskDefinition: apiTaskDef,
      assignPublicIp: true,
      desiredCount: 1,
    });

    const httpApi = new apigatewayv2.HttpApi(this, "IfcHttpApi", {
      description: "API Gateway for IFC Fargate Service",
    });

    httpApi.addRoutes({
      path: "/",
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpServiceDiscoveryIntegration(
        "IfcServiceIntegration",
        apiService.cloudMapService!
      ),
    });
  }
}
