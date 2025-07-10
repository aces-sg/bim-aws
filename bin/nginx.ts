import { App } from "aws-cdk-lib";
import { NginxProxyStack } from "../lib/nginx-proxy-stack"; // Ensure this path and name are correct
import { IfcApiCdkStack } from "../lib/ifc-proxy-stack";

const app = new App();

new NginxProxyStack(app, "NginxProxyStackThree");
new IfcApiCdkStack(app, "IfcApiCdkStack");
