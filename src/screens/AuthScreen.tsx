import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../aws/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

type AuthMode = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset';

export default function AuthScreen() {
  const navigation = useNavigation();
  const { themeColors } = useTheme();
  const { signIn, signInWithPasskey, signUp, confirmSignUp, resetPassword, confirmResetPassword } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const clearForm = () => {
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setError('');
  };

  const handlePasskeySignIn = async () => {
    if (!username) {
      setError('Please enter your username');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await signInWithPasskey(username);
      navigation.goBack();
    } catch (err: any) {
      console.log('Passkey sign in error:', err);
      setError(err.message || 'Passkey sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Trim whitespace from username
      const trimmedUsername = username.trim().toLowerCase();
      console.log('Attempting sign in for:', trimmedUsername);
      await signIn(trimmedUsername, password);
      console.log('Sign in successful');
      // Navigate back to Settings after successful sign in
      navigation.goBack();
    } catch (err: any) {
      console.log('Sign in error:', err);
      // Provide more helpful error messages
      let errorMessage = err.message || 'Sign in failed';
      if (errorMessage.includes('Unknown') || errorMessage.includes('unknown')) {
        errorMessage = 'Sign in failed. Please check your username and password, or try creating a new account.';
      } else if (err.name === 'NotAuthorizedException') {
        errorMessage = 'Incorrect username or password. Make sure you\'re using the exact username you signed up with.';
      } else if (err.name === 'UserNotFoundException') {
        errorMessage = 'User not found. Please check your username or create an account.';
      } else if (err.name === 'UserNotConfirmedException') {
        errorMessage = 'Please verify your email first. Check your inbox for a verification code.';
        // Switch to confirm mode so user can enter code
        setMode('confirm');
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!username || !email || !password || !name) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await signUp(username, email, password, name);
      if (result.needsConfirmation) {
        setMode('confirm');
        Alert.alert('Check Your Email', 'We sent a verification code to ' + email);
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!code) {
      setError('Please enter the verification code');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await confirmSignUp(username, code);
      setMode('signin');
      Alert.alert('Success!', 'Your account is verified. Please sign in.');
      clearForm();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!username) {
      setError('Please enter your username');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await resetPassword(username);
      setMode('reset');
      Alert.alert('Check Your Email', 'We sent a password reset code to your email');
    } catch (err: any) {
      setError(err.message || 'Reset request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code || !password) {
      setError('Please enter code and new password');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await confirmResetPassword(username, code, password);
      setMode('signin');
      Alert.alert('Success!', 'Password reset. Please sign in.');
      clearForm();
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => {
    switch (mode) {
      case 'signin':
        return (
          <>
            <Text style={styles.title}>Welcome Back 💕</Text>
            <Text style={styles.subtitle}>Sign in to sync your health data</Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: themeColors.primary }]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setMode('forgot'); clearForm(); }}>
              <Text style={[styles.link, { color: themeColors.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.passkeyButton, { borderColor: themeColors.primary }]}
              onPress={handlePasskeySignIn}
              disabled={isLoading}
            >
              <Ionicons name="finger-print" size={22} color={themeColors.primary} />
              <Text style={[styles.passkeyButtonText, { color: themeColors.primary }]}>Sign In with Passkey</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => { setMode('signup'); clearForm(); }}
            >
              <Text style={[styles.secondaryButtonText, { color: themeColors.primary }]}>Create Account</Text>
            </TouchableOpacity>
          </>
        );

      case 'signup':
        return (
          <>
            <Text style={styles.title}>Create Account ✨</Text>
            <Text style={styles.subtitle}>Sync your data across all devices</Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="text-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="off"
                textContentType="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password (8+ characters)"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: themeColors.primary }]}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setMode('signin'); clearForm(); }}>
              <Text style={[styles.link, { color: themeColors.primary }]}>Already have an account? Sign In</Text>
            </TouchableOpacity>
          </>
        );

      case 'confirm':
        return (
          <>
            <Text style={styles.title}>Verify Email 📧</Text>
            <Text style={styles.subtitle}>Enter the code we sent to {email}</Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Verification Code"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="off"
                textContentType="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: themeColors.primary }]}
              onPress={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setMode('signin'); clearForm(); }}>
              <Text style={[styles.link, { color: themeColors.primary }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        );

      case 'forgot':
        return (
          <>
            <Text style={styles.title}>Reset Password 🔑</Text>
            <Text style={styles.subtitle}>Enter your username to receive a reset code</Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: themeColors.primary }]}
              onPress={handleForgotPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setMode('signin'); clearForm(); }}>
              <Text style={[styles.link, { color: themeColors.primary }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        );

      case 'reset':
        return (
          <>
            <Text style={styles.title}>New Password 🔐</Text>
            <Text style={styles.subtitle}>Enter the code and your new password</Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Reset Code"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="off"
                textContentType="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: themeColors.primary }]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setMode('signin'); clearForm(); }}>
              <Text style={[styles.link, { color: themeColors.primary }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.logoContainer, { backgroundColor: themeColors.primaryLight }]}>
          <Ionicons name="heart" size={48} color={themeColors.primary} />
        </View>

        <View style={styles.formContainer}>
          {renderForm()}
          
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.skipText}>
          You can use the app without signing in.{'\n'}
          Sign in enables cloud sync across devices.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    height: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  passkeyButton: {
    height: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.sm,
  },
  passkeyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    color: colors.textMuted,
    fontSize: 13,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginLeft: spacing.xs,
    flex: 1,
  },
  skipText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});
