// AWS Amplify Configuration for HealthTracker
// Using Amplify Gen2 configuration format

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-2_3MEpgLVnp',
      userPoolClientId: '180i0i3fp5h2atlp5939cag489',
      signUpVerificationMethod: 'code' as const,
      loginWith: {
        email: true,
        username: true,
      },
    },
  },
};

export default awsConfig;

// Flag to check if AWS is configured
export const isAWSConfigured = () => {
  return (
    awsConfig.Auth.Cognito.userPoolId !== 'YOUR_USER_POOL_ID' &&
    awsConfig.Auth.Cognito.userPoolClientId !== 'YOUR_CLIENT_ID'
  );
};
