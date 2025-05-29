import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";

export interface CognitoStackProps extends cdk.StackProps {
    callbackUrls: string[];
    logoutUrls: string[];
    userPoolDomain?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    microsoftClientId?: string;
    microsoftClientSecret?: string;
    microsoftTenantId?: string;
}

export class CognitoStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CognitoStackProps) {
        super(scope, id, props);

        // Create a Cognito User Pool
        const userPool = new cognito.UserPool(this, "SaffiraUserPool", {
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
            },
            autoVerify: {
                email: true,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy:
                process.env.NODE_ENV === "development" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        });

        // Google and Microsoft Identity Providers
        const supportedProviders: cognito.UserPoolClientIdentityProvider[] = [
            cognito.UserPoolClientIdentityProvider.COGNITO,
        ];
        const dependencies: Construct[] = [];

        let googleProvider: cognito.UserPoolIdentityProviderGoogle | undefined;
        if (props.googleClientId && props.googleClientSecret) {
            googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, "SaffiraGoogleProvider", {
                userPool: userPool,
                clientId: props.googleClientId || "",
                clientSecretValue: cdk.SecretValue.unsafePlainText(props.googleClientSecret),
                scopes: ["email", "profile", "openid"],
                attributeMapping: {
                    email: cognito.ProviderAttribute.GOOGLE_EMAIL,
                    givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
                    familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
                    profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
                },
            });
            userPool.registerIdentityProvider(googleProvider);
            supportedProviders.push(cognito.UserPoolClientIdentityProvider.GOOGLE);
            dependencies.push(googleProvider);
        }

        let microsoftProvider: cognito.UserPoolIdentityProviderOidc | undefined;
        if (props.microsoftClientId && props.microsoftClientSecret && props.microsoftTenantId) {
            microsoftProvider = new cognito.UserPoolIdentityProviderOidc(this, "SaffiraMicrosoftProvider", {
                userPool: userPool,
                name: "Microsoft",
                clientId: props.microsoftClientId || "",
                clientSecret: props.microsoftClientSecret || "",
                issuerUrl: `https://login.microsoftonline.com/${props.microsoftTenantId}/v2.0`,
                scopes: ["openid", "profile", "email"],
                attributeMapping: {
                    email: cognito.ProviderAttribute.other("email"),
                    givenName: cognito.ProviderAttribute.other("given_name"),
                    familyName: cognito.ProviderAttribute.other("family_name"),
                    profilePicture: cognito.ProviderAttribute.other("picture"),
                },
            });
            userPool.registerIdentityProvider(microsoftProvider);
            supportedProviders.push(cognito.UserPoolClientIdentityProvider.custom("Microsoft"));
            dependencies.push(microsoftProvider);
        }

        // Create a User Pool Client
        const userPoolClient = userPool.addClient("SaffiraUserPoolClient", {
            userPoolClientName: "SaffiraUserPoolClient",
            authFlows: {
                userSrp: true,
            },
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.COGNITO,
                cognito.UserPoolClientIdentityProvider.GOOGLE,
                cognito.UserPoolClientIdentityProvider.custom("Microsoft"),
            ],
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                callbackUrls: props.callbackUrls,
                logoutUrls: props.logoutUrls,
                scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
            },
            preventUserExistenceErrors: true,
        });

        dependencies.forEach((provider) => {
            userPoolClient.node.addDependency(provider);
        });

        // Set the user pool domain if provided
        if (props.userPoolDomain) {
            userPool.addDomain("SaffiraUserPoolDomain", {
                cognitoDomain: {
                    domainPrefix: props.userPoolDomain,
                },
            });
        }

        // Output the User Pool ID and Client ID
        new cdk.CfnOutput(this, "UserPoolId", {
            value: userPool.userPoolId,
            description: "The ID of the Cognito User Pool",
            exportName: "SaffiraUserPoolId",
        });
        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: userPoolClient.userPoolClientId,
            description: "The ID of the Cognito User Pool Client",
            exportName: "SaffiraUserPoolClientId",
        });
    }
}
