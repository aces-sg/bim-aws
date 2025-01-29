import { App } from "aws-cdk-lib";
import { NginxProxyStack } from "../lib/nginx-proxy-stack"; // Ensure this path and name are correct

const app = new App();
new NginxProxyStack(app, "NginxProxyStack");
