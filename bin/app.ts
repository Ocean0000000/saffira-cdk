#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/stacks/cognito-stack';

const app = new cdk.App();

if (!process.env.REDIRECT_SIGN_IN || !process.env.REDIRECT_SIGN_OUT) {
  throw new Error('Environment variables REDIRECT_SIGN_IN and REDIRECT_SIGN_OUT must be set.');
};

new CognitoStack(app, 'SaffiraCognitoStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  callbackUrls: [process.env.REDIRECT_SIGN_IN],
  logoutUrls: [process.env.REDIRECT_SIGN_OUT],
  userPoolDomain: "saffira",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID,
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  microsoftTenantId: process.env.MICROSOFT_TENANT_ID,
});