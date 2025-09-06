import type { CustomMessageTriggerEvent } from 'aws-lambda/trigger/cognito-user-pool-trigger/custom-message';

export const handler = async (event: CustomMessageTriggerEvent) => {
    console.log("Event: ", JSON.stringify(event, null, 2));

    if (event.triggerSource !== "CustomMessage_SignUp") {
        return event;
    }
    
    const email = event.request.userAttributes.email;
    const code = event.request.codeParameter;
    const givenName = event.request.userAttributes.given_name;
    const link = `${process.env.DEPLOYMENT_URL}/confirm?username=${email}&code=${code}`;

    event.response.emailSubject = `Welcome to Saffira, ${givenName}!`;
    event.response.emailMessage = `Hi ${givenName}, welcome to Saffira! Please verify your email address by clicking this link: ${link}`;

    return event;
};