import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Tags, RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import { HttpApi, HttpMethod, VpcLink } from "@aws-cdk/aws-apigatewayv2-alpha";
import { HttpAlbIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";

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

    const image = new ecr_assets.DockerImageAsset(this, "IfcApiImage", {
      directory: "lib/docker/ifc",
      platform: ecr_assets.Platform.LINUX_AMD64,
    });

    apiTaskDef.addContainer("IfcApi", {
      image: ecs.ContainerImage.fromDockerImageAsset(image),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "ifcapi" }),
      portMappings: [{ containerPort: 8069 }],
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      healthCheck: {
        command: [
          "CMD-SHELL",
          "curl -sS http://localhost:8069/health || echo 'Health check failed'",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(10),
      },
    });

    const lbFargateService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(
        this,
        "IfcApiService",
        {
          cluster,
          taskDefinition: apiTaskDef,
          publicLoadBalancer: true,
          desiredCount: 2,
        }
      );

    // Set ALB health check to match your app
    lbFargateService.targetGroup.configureHealthCheck({
      path: "/health",
      healthyHttpCodes: "200",
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      unhealthyThresholdCount: 2,
      healthyThresholdCount: 2,
    });

    const vpcLink = new VpcLink(this, "IfcVpcLink", {
      vpc,
    });

    const albIntegration = new HttpAlbIntegration(
      "IfcAlbIntegration",
      lbFargateService.listener,
      { vpcLink }
    );

    const httpApi = new HttpApi(this, "IfcHttpApi", {
      description: "API Gateway for IFC Fargate Service",
    });

    httpApi.addRoutes({
      path: "/",
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: albIntegration,
    });
  }
}
