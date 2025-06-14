import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as path from "path";
import * as fs from "fs";

export class NginxProxyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      env: {
        region: "ap-southeast-1",
      },
      ...props,
    });

    // Create VPC
    const vpc = new ec2.Vpc(this, "NginxVpc", {
      maxAzs: 2, // Ensures redundancy across availability zones
      natGateways: 0,
    });

    // Security group for ALB
    const albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc,
      description: "Security group for ALB",
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic"
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS traffic"
    );

    // Security group for EC2 instances
    const ec2SecurityGroup = new ec2.SecurityGroup(this, "NginxSecurityGroup", {
      vpc,
      description: "Security group for Nginx instances",
      allowAllOutbound: true,
    });

    // Allow ALB to communicate with EC2 instances
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
      ec2.Port.tcp(80),
      "Allow HTTP traffic from ALB"
    );

    // Allow SSH Access
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), // Replace with your IP if needed
      ec2.Port.tcp(22),
      "Allow SSH access"
    );

    // Create ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, "NginxAlb", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // Create ACM certificate
    const certificate = new acm.Certificate(this, "NginxCertificate", {
      domainName: "bim.com.sg",
      subjectAlternativeNames: ["*.bim.com.sg"],
      validation: acm.CertificateValidation.fromDns(),
    });

    const bimecocertificate = new acm.Certificate(
      this,
      "NginxCertificateBimeco",
      {
        domainName: "bimeco.io",
        subjectAlternativeNames: ["*.bimeco.io"],
        validation: acm.CertificateValidation.fromDns(),
      }
    );

    // User data script for Nginx setup
    const userData = ec2.UserData.forLinux();
    const initBlog = path.join(__dirname, "./bootstrap-blog.sh");
    const userDataScript = fs.readFileSync(initBlog, "utf8");

    userData.addCommands(userDataScript);

    // Define a Launch Template for EC2 instances
    const launchTemplate = new ec2.LaunchTemplate(
      this,
      "NginxLaunchTemplate-v2",
      {
        machineImage: ec2.MachineImage.genericLinux({
          "ap-southeast-1": "ami-0672fd5b9210aa093",
        }),
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T2,
          ec2.InstanceSize.MICRO
        ),
        keyName: "default-bim",
        securityGroup: ec2SecurityGroup,
        userData,
      }
    );

    // Create an Auto Scaling Group
    const autoScalingGroup = new autoscaling.AutoScalingGroup(
      this,
      "NginxAsg",
      {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        minCapacity: 3, // Ensures at least 3 instances
        maxCapacity: 4, // Can scale up if needed
        launchTemplate,
        healthCheck: autoscaling.HealthCheck.elb({
          grace: cdk.Duration.minutes(30),
        }),
      }
    );

    // Create target group for ALB
    const targetGroup = new elbv2.ApplicationTargetGroup(
      this,
      "NginxTargetGroup",
      {
        vpc,
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [autoScalingGroup],
        targetType: elbv2.TargetType.INSTANCE,
        healthCheck: {
          path: "/health",
          healthyHttpCodes: "200-399",
        },
      }
    );

    // Create ALB listeners
    alb.addRedirect(); // Redirect HTTP to HTTPS

    alb.addListener("HttpsListener", {
      port: 443,
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
      certificates: [
        elbv2.ListenerCertificate.fromCertificateManager(certificate),
        elbv2.ListenerCertificate.fromCertificateManager(bimecocertificate),
      ],
    });

    // Output the ALB DNS name
    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: `http://${alb.loadBalancerDnsName}`,
      description: "DNS name of the load balancer",
    });
  }
}
