import { StackProps, Stack, RemovalPolicy, SecretValue, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { join } from "path";
import {
    UserPool,
    VerificationEmailStyle,
    AccountRecovery,
    UserPoolClientIdentityProvider,
    UserPoolIdentityProviderGoogle,
    UserPoolIdentityProviderOidc,
    ProviderAttribute,
    OAuthScope,
    UserPoolEmail,
} from "aws-cdk-lib/aws-cognito";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";

export interface CognitoStackProps extends StackProps {
    deploymentUrl: string;
    userPoolDomain: string;
    googleClientId: string;
    googleClientSecret: string;
    microsoftClientId: string;
    microsoftClientSecret: string;
    microsoftTenantId: string;
}

export class CognitoStack extends Stack {
    constructor(scope: Construct, id: string, props: CognitoStackProps) {
        super(scope, id, props);

        const {
            userPoolDomain,
            deploymentUrl,
            googleClientId,
            googleClientSecret,
            microsoftClientId,
            microsoftClientSecret,
            microsoftTenantId,
        } = props;

        const customSignUpMessageFn = new NodejsFunction(this, "CustomSignUpMessage", {
            runtime: Runtime.NODEJS_22_X,
            entry: join(__dirname, "../lambda/custom-sign-up-message/index.ts"),
            handler: "index.handler",
            environment: {
                DEPLOYMENT_URL: deploymentUrl,
            },
        });

        const userPool = new UserPool(this, "SaffiraUserPool", {
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
            },
            passwordPolicy: {
                minLength: 8,
                requireUppercase: true,
                requireDigits: true,
            },
            autoVerify: {
                email: true,
            },
            userVerification: {
                emailStyle: VerificationEmailStyle.CODE,
                emailSubject: "Verify your email for Saffira.ai",
                emailBody: "Your verification code is: {####}",
            },
            lambdaTriggers: {
                customMessage: customSignUpMessageFn,
            },
            accountRecovery: AccountRecovery.EMAIL_ONLY,
            removalPolicy: process.env.NODE_ENV === "development" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        });

        const supportedProviders: UserPoolClientIdentityProvider[] = [UserPoolClientIdentityProvider.COGNITO];
        const dependencies: Construct[] = [];

        let googleProvider: UserPoolIdentityProviderGoogle | undefined;
        if (googleClientId && googleClientSecret) {
            googleProvider = new UserPoolIdentityProviderGoogle(this, "SaffiraGoogleProvider", {
                userPool: userPool,
                clientId: googleClientId || "",
                clientSecretValue: SecretValue.unsafePlainText(googleClientSecret),
                scopes: ["email", "profile", "openid"],
                attributeMapping: {
                    email: ProviderAttribute.GOOGLE_EMAIL,
                    givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
                    familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
                    profilePicture: ProviderAttribute.GOOGLE_PICTURE,
                },
            });
            userPool.registerIdentityProvider(googleProvider);
            supportedProviders.push(UserPoolClientIdentityProvider.GOOGLE);
            dependencies.push(googleProvider);
        }

        let microsoftProvider: UserPoolIdentityProviderOidc | undefined;
        if (microsoftClientId && microsoftClientSecret && microsoftTenantId) {
            microsoftProvider = new UserPoolIdentityProviderOidc(this, "SaffiraMicrosoftProvider", {
                userPool: userPool,
                name: "Microsoft",
                clientId: microsoftClientId || "",
                clientSecret: microsoftClientSecret || "",
                issuerUrl: `https://login.microsoftonline.com/${microsoftTenantId}/v2.0`,
                scopes: ["openid", "profile", "email"],
                attributeMapping: {
                    email: ProviderAttribute.other("email"),
                    givenName: ProviderAttribute.other("given_name"),
                    familyName: ProviderAttribute.other("family_name"),
                    profilePicture: ProviderAttribute.other("picture"),
                },
            });
            userPool.registerIdentityProvider(microsoftProvider);
            supportedProviders.push(UserPoolClientIdentityProvider.custom("Microsoft"));
            dependencies.push(microsoftProvider);
        }

        const userPoolClient = userPool.addClient("SaffiraUserPoolClient", {
            userPoolClientName: "SaffiraUserPoolClient",
            authFlows: {
                userSrp: true,
            },
            supportedIdentityProviders: [
                UserPoolClientIdentityProvider.COGNITO,
                UserPoolClientIdentityProvider.GOOGLE,
                UserPoolClientIdentityProvider.custom("Microsoft"),
            ],
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                callbackUrls: [deploymentUrl + "/callback"],
                logoutUrls: [deploymentUrl + "/login"],
                scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE],
            },
            preventUserExistenceErrors: true,
        });

        dependencies.forEach((provider) => {
            userPoolClient.node.addDependency(provider);
        });

        // Set the user pool domain if provided
        if (userPoolDomain) {
            userPool.addDomain("SaffiraUserPoolDomain", {
                cognitoDomain: {
                    domainPrefix: userPoolDomain,
                },
            });
        }

        new CfnOutput(this, "UserPoolId", {
            value: userPool.userPoolId,
            description: "The ID of the Cognito User Pool",
            exportName: "SaffiraUserPoolId",
        });
        new CfnOutput(this, "UserPoolClientId", {
            value: userPoolClient.userPoolClientId,
            description: "The ID of the Cognito User Pool Client",
            exportName: "SaffiraUserPoolClientId",
        });
    }
}
