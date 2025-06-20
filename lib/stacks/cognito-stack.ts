import { StackProps, Stack, RemovalPolicy, SecretValue, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
    UserPool,
    AccountRecovery,
    UserPoolClientIdentityProvider,
    UserPoolIdentityProviderGoogle,
    UserPoolIdentityProviderOidc,
    ProviderAttribute,
    OAuthScope,
} from "aws-cdk-lib/aws-cognito";

export interface CognitoStackProps extends StackProps {
    callbackUrls: string[];
    logoutUrls: string[];
    userPoolDomain?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    microsoftClientId?: string;
    microsoftClientSecret?: string;
    microsoftTenantId?: string;
}

export class CognitoStack extends Stack {
    constructor(scope: Construct, id: string, props: CognitoStackProps) {
        super(scope, id, props);

        // Create a Cognito User Pool
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
            accountRecovery: AccountRecovery.EMAIL_ONLY,
            removalPolicy:
                process.env.NODE_ENV === "development" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        });

        // Google and Microsoft Identity Providers
        const supportedProviders: UserPoolClientIdentityProvider[] = [
            UserPoolClientIdentityProvider.COGNITO,
        ];
        const dependencies: Construct[] = [];

        let googleProvider: UserPoolIdentityProviderGoogle | undefined;
        if (props.googleClientId && props.googleClientSecret) {
            googleProvider = new UserPoolIdentityProviderGoogle(this, "SaffiraGoogleProvider", {
                userPool: userPool,
                clientId: props.googleClientId || "",
                clientSecretValue: SecretValue.unsafePlainText(props.googleClientSecret),
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
        if (props.microsoftClientId && props.microsoftClientSecret && props.microsoftTenantId) {
            microsoftProvider = new UserPoolIdentityProviderOidc(this, "SaffiraMicrosoftProvider", {
                userPool: userPool,
                name: "Microsoft",
                clientId: props.microsoftClientId || "",
                clientSecret: props.microsoftClientSecret || "",
                issuerUrl: `https://login.microsoftonline.com/${props.microsoftTenantId}/v2.0`,
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

        // Create a User Pool Client
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
                callbackUrls: props.callbackUrls,
                logoutUrls: props.logoutUrls,
                scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE],
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
