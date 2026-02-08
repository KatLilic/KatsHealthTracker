import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isAWSConfigured } from './amplifyConfigure';

// Only import AWS auth functions if AWS is configured
let signUp: any, signIn: any, signOut: any, getCurrentUser: any;
let confirmSignUp: any, resetPassword: any, confirmResetPassword: any, fetchAuthSession: any;
let autoSignIn: any, associateWebAuthnCredential: any, listWebAuthnCredentials: any;
let deleteWebAuthnCredential: any;

if (isAWSConfigured()) {
  try {
    const authModule = require('aws-amplify/auth');
    signUp = authModule.signUp;
    signIn = authModule.signIn;
    signOut = authModule.signOut;
    getCurrentUser = authModule.getCurrentUser;
    confirmSignUp = authModule.confirmSignUp;
    resetPassword = authModule.resetPassword;
    confirmResetPassword = authModule.confirmResetPassword;
    fetchAuthSession = authModule.fetchAuthSession;
    autoSignIn = authModule.autoSignIn;
    associateWebAuthnCredential = authModule.associateWebAuthnCredential;
    listWebAuthnCredentials = authModule.listWebAuthnCredentials;
    deleteWebAuthnCredential = authModule.deleteWebAuthnCredential;
  } catch (e) {
    console.log('AWS Auth not available');
  }
}

interface User {
  userId: string;
  email: string;
  isVerified: boolean;
}

interface PasskeyCredential {
  credentialId: string;
  friendlyName?: string;
  createdAt?: Date;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAWSEnabled: boolean;
  signUp: (username: string, email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  confirmSignUp: (username: string, code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithPasskey: (username: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmResetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  registerPasskey: () => Promise<void>;
  listPasskeys: () => Promise<PasskeyCredential[]>;
  deletePasskey: (credentialId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAWSEnabled = isAWSConfigured();

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    if (!isAWSEnabled) {
      console.log('AWS not enabled, skipping user check');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Checking current user...');
      const currentUser = await getCurrentUser();
      console.log('Current user:', JSON.stringify(currentUser, null, 2));
      
      const session = await fetchAuthSession();
      console.log('Session valid:', !!session.tokens);
      
      setUser({
        userId: currentUser.userId,
        email: currentUser.signInDetails?.loginId || currentUser.username || '',
        isVerified: true,
      });
      console.log('User state updated successfully');
    } catch (error) {
      // Not signed in
      console.log('No current user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (username: string, email: string, password: string, name: string) => {
    if (!isAWSEnabled || !signUp) {
      throw new Error('AWS is not configured. Cloud sync is not available yet.');
    }
    const result = await signUp({
      username,
      password,
      options: {
        userAttributes: {
          email,
          name,
        },
      },
    });

    return {
      needsConfirmation: !result.isSignUpComplete,
    };
  };

  const handleConfirmSignUp = async (username: string, code: string) => {
    if (!isAWSEnabled || !confirmSignUp) {
      throw new Error('AWS is not configured.');
    }
    await confirmSignUp({
      username,
      confirmationCode: code,
    });
  };

  const handleSignIn = async (username: string, password: string) => {
    if (!isAWSEnabled || !signIn) {
      throw new Error('AWS is not configured. Cloud sync is not available yet.');
    }
    
    try {
      console.log('Attempting signIn with username:', username);
      
      // First, try to clear any existing auth session to avoid "Unknown" errors
      try {
        await signOut({ global: false });
      } catch (e) {
        // Ignore sign out errors - user may not be signed in
        console.log('Pre-signIn cleanup (expected):', e);
      }
      
      const result = await signIn({
        username,
        password,
        options: {
          authFlowType: 'USER_PASSWORD_AUTH',
        },
      });

      console.log('Sign in result:', JSON.stringify(result, null, 2));

      // Handle different sign-in states
      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        throw new Error('Please verify your email first. Check your inbox for a verification code.');
      }
      
      if (result.nextStep?.signInStep === 'DONE' || result.isSignedIn) {
        await checkCurrentUser();
      } else {
        // If not done and not signed in, check what step is needed
        throw new Error(`Sign in requires: ${result.nextStep?.signInStep || 'unknown step'}`);
      }
    } catch (error: any) {
      console.log('Sign in error details:', error.name, error.message, JSON.stringify(error));
      
      // Map Cognito errors to user-friendly messages
      const errorName = error.name || '';
      const errorMessage = error.message || '';
      
      // Provide better error messages for common Cognito errors
      if (errorName === 'NotAuthorizedException') {
        throw new Error('Incorrect username or password. Please try again.');
      } else if (errorName === 'UserNotFoundException') {
        throw new Error('No account found with this username. Please sign up first.');
      } else if (errorName === 'UserNotConfirmedException') {
        throw new Error('Please verify your email first. Check your inbox for a verification code.');
      } else if (errorName === 'PasswordResetRequiredException') {
        throw new Error('You need to reset your password. Use the Forgot Password option.');
      } else if (errorMessage.includes('Network') || errorMessage.includes('network')) {
        throw new Error('Network error. Please check your internet connection.');
      } else if (errorName === 'Unknown' || errorMessage.includes('Unknown') || errorMessage.includes('unknown')) {
        // The "Unknown" error often means the auth flow is stuck - suggest specific actions
        throw new Error('Authentication error. Please close the app completely and try again. If the issue persists, try resetting your password.');
      } else if (errorName === 'UserAlreadyAuthenticatedException') {
        // Already signed in, just check current user
        await checkCurrentUser();
        return;
      }
      
      // Re-throw with original error
      throw error;
    }
  };

  const handleSignOut = async () => {
    if (!isAWSEnabled || !signOut) {
      setUser(null);
      return;
    }
    await signOut();
    setUser(null);
  };

  const handleResetPassword = async (email: string) => {
    if (!isAWSEnabled || !resetPassword) {
      throw new Error('AWS is not configured.');
    }
    await resetPassword({ username: email });
  };

  const handleConfirmResetPassword = async (
    email: string,
    code: string,
    newPassword: string
  ) => {
    if (!isAWSEnabled || !confirmResetPassword) {
      throw new Error('AWS is not configured.');
    }
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });
  };

  const getAccessToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() || null;
    } catch {
      return null;
    }
  };

  // Passkey/WebAuthn functions
  const handleSignInWithPasskey = async (username: string) => {
    if (!isAWSEnabled || !signIn) {
      throw new Error('AWS is not configured.');
    }
    
    // Clear any existing session first
    try {
      await signOut({ global: false });
    } catch (e) {
      // Ignore
    }
    
    const result = await signIn({
      username,
      options: {
        authFlowType: 'USER_AUTH',
        preferredChallenge: 'WEB_AUTHN',
      },
    });

    console.log('Passkey sign in result:', JSON.stringify(result, null, 2));

    if (result.nextStep?.signInStep === 'DONE' || result.isSignedIn) {
      await checkCurrentUser();
    } else {
      throw new Error(`Passkey sign in requires: ${result.nextStep?.signInStep || 'unknown step'}`);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!isAWSEnabled || !associateWebAuthnCredential) {
      throw new Error('AWS is not configured or passkeys not supported.');
    }
    if (!user) {
      throw new Error('You must be signed in to register a passkey.');
    }
    
    await associateWebAuthnCredential();
    console.log('Passkey registered successfully');
  };

  const handleListPasskeys = async (): Promise<PasskeyCredential[]> => {
    if (!isAWSEnabled || !listWebAuthnCredentials) {
      return [];
    }
    if (!user) {
      return [];
    }
    
    const result = await listWebAuthnCredentials();
    return result.credentials?.map((c: any) => ({
      credentialId: c.credentialId,
      friendlyName: c.friendlyCredentialName,
      createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
    })) || [];
  };

  const handleDeletePasskey = async (credentialId: string) => {
    if (!isAWSEnabled || !deleteWebAuthnCredential) {
      throw new Error('AWS is not configured.');
    }
    
    await deleteWebAuthnCredential({ credentialId });
    console.log('Passkey deleted');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAWSEnabled,
        signUp: handleSignUp,
        confirmSignUp: handleConfirmSignUp,
        signIn: handleSignIn,
        signInWithPasskey: handleSignInWithPasskey,
        signOut: handleSignOut,
        resetPassword: handleResetPassword,
        confirmResetPassword: handleConfirmResetPassword,
        getAccessToken,
        registerPasskey: handleRegisterPasskey,
        listPasskeys: handleListPasskeys,
        deletePasskey: handleDeletePasskey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
