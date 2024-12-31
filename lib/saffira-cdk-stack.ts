import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class SaffiraCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'SaffiraCdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    // Create an S3 bucket
    const bucket = new s3.Bucket(this, 'SaffiraAIStudentDataBucket', {
      bucketName: `saffira-ai-student-data-${cdk.Aws.ACCOUNT_ID}`, // Optional: set a unique name globally
      publicReadAccess: false, // Disable public access for security
      versioned: true, // Enable versioning for auditability
      encryption: s3.BucketEncryption.S3_MANAGED, // Enable encryption
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically delete during stack cleanup (use cautiously in production)
    });

    // Output the bucket name
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });
  }
}