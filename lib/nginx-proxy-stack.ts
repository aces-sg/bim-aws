import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class NginxProxyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      env: {
        region: "ap-southeast-1",
      },
      ...props,
    });

    const vpc = new ec2.Vpc(this, "NginxVpc", {
      maxAzs: 1,
      natGateways: 0,
    });

    const securityGroup = new ec2.SecurityGroup(this, "NginxSecurityGroup", {
      vpc,
      description: "Allow HTTP, HTTPS and SSH traffic",
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS traffic"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH traffic"
    );

    const ubuntuAmi = ec2.MachineImage.genericLinux({
      "ap-southeast-1": "ami-0672fd5b9210aa093",
    });

    const keyPair = new ec2.CfnKeyPair(this, "NginxKeyPair", {
      keyName: "nginx-key-pair",
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "sudo apt-get update -y",
      "sudo apt-get install -y nginx",

      `sudo bash -c 'cat > /etc/nginx/sites-available/default <<EOF

# Default server block
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # For the main website
    location / {
        proxy_pass https://www.bim.com.sg;
        proxy_set_header Host www.bim.com.sg;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_ssl_server_name on;
    }

    # For Next.js static files in jobs section
    location /_next/ {
        proxy_pass https://jobs.bimeco.io/_next/;
        proxy_set_header Host jobs.bimeco.io;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_ssl_server_name on;
    }

    # For the jobs section
    location /jobs {
        # Rewrite /jobs to /career
        rewrite ^/jobs(/.*)?\\$ /career\\$1 break;
        proxy_pass https://jobs.bimeco.io;
        proxy_set_header Host jobs.bimeco.io;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_ssl_server_name on;

        proxy_redirect https://jobs.bimeco.io/career/ /jobs/;

        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # error handling
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}

EOF'`,
      "sudo nginx -t",
      "sudo systemctl restart nginx",
      "sudo systemctl enable nginx"
    );

    const instance = new ec2.Instance(this, "NginxInstance", {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ubuntuAmi,
      securityGroup,
      keyName: keyPair.keyName,
      userData,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    const elasticIp = new ec2.CfnEIP(this, "NginxElasticIP", {
      domain: "vpc",
    });

    new ec2.CfnEIPAssociation(this, "NginxElasticIPAssociation", {
      allocationId: elasticIp.attrAllocationId,
      instanceId: instance.instanceId,
    });

    new cdk.CfnOutput(this, "RootLink", {
      value: `http://${elasticIp.ref}`,
      description: "HTTP link associated with the NGINX proxy server for root",
    });

    new cdk.CfnOutput(this, "JobsLink", {
      value: `http://${elasticIp.ref}/jobs`,
      description: "HTTP link associated with the NGINX proxy server for jobs",
    });

    new cdk.CfnOutput(this, "KeyPairName", {
      value: keyPair.keyName,
      description: "The name of the created key pair",
    });
  }
}
