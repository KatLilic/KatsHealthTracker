import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

const BIOMETRIC_ENABLED_KEY = '@biometric_lock_enabled';
const LOCK_TIMEOUT_KEY = '@biometric_lock_timeout';

type BiometricType = 'none' | 'fingerprint' | 'facial' | 'iris';

interface BiometricContextType {
  isLocked: boolean;
  isEnabled: boolean;
  isAvailable: boolean;
  biometricType: BiometricType;
  lockTimeout: number; // minutes, 0 = immediate
  authenticate: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setLockTimeout: (minutes: number) => Promise<void>;
  unlock: () => void;
  lock: () => void;
}

const BiometricContext = createContext<BiometricContextType | undefined>(undefined);

export const useBiometric = () => {
  const context = useContext(BiometricContext);
  if (!context) {
    throw new Error('useBiometric must be used within a BiometricProvider');
  }
  return context;
};

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [isEnabled, setIsEnabledState] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [lockTimeout, setLockTimeoutState] = useState(0);
  const [lastBackground, setLastBackground] = useState<number | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Check biometric availability on mount
  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsAvailable(compatible && enrolled);

        if (compatible) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('facial');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType('fingerprint');
          } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
            setBiometricType('iris');
          }
        }
      } catch (error) {
        console.error('Error checking biometric:', error);
        setIsAvailable(false);
      }
    };

    checkBiometric();
  }, []);

  // Load saved preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [enabledStr, timeoutStr] = await Promise.all([
          AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY),
          AsyncStorage.getItem(LOCK_TIMEOUT_KEY),
        ]);

        const enabled = enabledStr === 'true';
        const timeout = timeoutStr ? parseInt(timeoutStr, 10) : 0;

        setIsEnabledState(enabled);
        setLockTimeoutState(timeout);

        // If biometric is enabled, lock the app initially
        if (enabled) {
          setIsLocked(true);
        }

        setHasInitialized(true);
      } catch (error) {
        console.error('Error loading biometric preferences:', error);
        setHasInitialized(true);
      }
    };

    loadPreferences();
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (!isEnabled) return;

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Going to background - record the time
        setLastBackground(Date.now());
      } else if (nextAppState === 'active' && lastBackground !== null) {
        // Coming back to foreground - check if we should lock
        const timePassed = Date.now() - lastBackground;
        const timeoutMs = lockTimeout * 60 * 1000;

        if (lockTimeout === 0 || timePassed >= timeoutMs) {
          setIsLocked(true);
        }
        setLastBackground(null);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isEnabled, lockTimeout, lastBackground]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock HealthTracker',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    try {
      if (enabled) {
        // Verify biometric before enabling
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm to enable biometric lock',
          fallbackLabel: 'Use Passcode',
          cancelLabel: 'Cancel',
        });

        if (!result.success) {
          throw new Error('Authentication required to enable biometric lock');
        }
      }

      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled.toString());
      setIsEnabledState(enabled);

      if (!enabled) {
        setIsLocked(false);
      }
    } catch (error) {
      console.error('Error setting biometric enabled:', error);
      // If disabling, still force it off even if there's an error
      if (!enabled) {
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
        setIsEnabledState(false);
        setIsLocked(false);
      } else {
        throw error;
      }
    }
  }, []);

  const setLockTimeout = useCallback(async (minutes: number) => {
    try {
      await AsyncStorage.setItem(LOCK_TIMEOUT_KEY, minutes.toString());
      setLockTimeoutState(minutes);
    } catch (error) {
      console.error('Error setting lock timeout:', error);
      throw error;
    }
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
  }, []);

  const lock = useCallback(() => {
    if (isEnabled) {
      setIsLocked(true);
    }
  }, [isEnabled]);

  // Don't render children until we've loaded preferences
  if (!hasInitialized) {
    return null;
  }

  return (
    <BiometricContext.Provider
      value={{
        isLocked,
        isEnabled,
        isAvailable,
        biometricType,
        lockTimeout,
        authenticate,
        setEnabled,
        setLockTimeout,
        unlock,
        lock,
      }}
    >
      {children}
    </BiometricContext.Provider>
  );
};
