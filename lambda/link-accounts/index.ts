import { PreSignUpExternalProviderTriggerEvent } from "aws-lambda/trigger/cognito-user-pool-trigger/pre-signup";
import { CognitoIdentityProviderClient, ListUsersCommand, AdminLinkProviderForUserCommand, InvalidParameterException } from "@aws-sdk/client-cognito-identity-provider";

export const handler = async (event: PreSignUpExternalProviderTriggerEvent) => {
    console.log("Event: ", JSON.stringify(event, null, 2));

    if (event.triggerSource !== "PreSignUp_ExternalProvider") {
        return event;
    }

    const email = event.request.userAttributes.email;

    if (!email) {
        return event;
    }

    try {
        const client = new CognitoIdentityProviderClient({ region: event.region });

        const listUsers = new ListUsersCommand({
            UserPoolId: event.userPoolId,
            Filter: `email = "${email}"`,
        });

        const adminGetUserOutput = await client.send(listUsers);

        if (!adminGetUserOutput.Users || adminGetUserOutput.Users.length === 0) {
            return event;
        }

        const providerName = event.userName.split("_")[0];
        let providerAttributeName;
        let providerAttributeValue;
        
        if (providerName === "Google") {
            providerAttributeName = "Cognito_Subject";
            providerAttributeValue = event.userName.split("_")[1];
        } else if (providerName === "Microsoft") {
            providerAttributeName = "email";
            providerAttributeValue = email;
        } else {
            throw new Error(`Unsupported provider: ${providerName}`);
        }

        const adminLinkProviderForUser = new AdminLinkProviderForUserCommand({
            UserPoolId: event.userPoolId,
            DestinationUser: {
                ProviderName: "Cognito",
                ProviderAttributeValue: adminGetUserOutput.Users[0].Username,
            },
            SourceUser: {
                ProviderName: providerName,
                ProviderAttributeName: providerAttributeName,
                ProviderAttributeValue: providerAttributeValue,
            },
        });

        await client.send(adminLinkProviderForUser);

        console.log("Successfully linked accounts for user:", adminGetUserOutput.Users[0].Username);

        event.response.autoConfirmUser = true;
        event.response.autoVerifyEmail = true;
    } catch (error) {
        if (error instanceof InvalidParameterException && error.message.includes("SourceUser is already linked to DestinationUser")) {
            console.log("Accounts are already linked. Proceeding without error.");
            event.response.autoConfirmUser = true;
            event.response.autoVerifyEmail = true;
            return event;
        }

        console.error("Error linking accounts: ", error);
        throw error;
    }

    return event;
};
