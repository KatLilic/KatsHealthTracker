import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBiometric } from '../auth/BiometricContext';
import { useTheme } from '../theme/ThemeContext';

const { width } = Dimensions.get('window');

export const LockScreen: React.FC = () => {
  const { authenticate, biometricType, unlock, setEnabled } = useBiometric();
  const { themeColors } = useTheme();
  const [failCount, setFailCount] = useState(0);

  // Auto-trigger authentication on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      handleAuthenticate();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleAuthenticate = async () => {
    const success = await authenticate();
    if (!success) {
      setFailCount(prev => prev + 1);
    }
  };

  const handleEmergencyBypass = () => {
    Alert.alert(
      'Disable Biometric Lock?',
      'This will turn off biometric lock and let you back into the app. You can re-enable it in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disable & Unlock', 
          style: 'destructive',
          onPress: async () => {
            try {
              await setEnabled(false);
              unlock();
            } catch (e) {
              // Force unlock anyway
              unlock();
            }
          }
        },
      ]
    );
  };

  const getIcon = (): 'scan-outline' | 'finger-print-outline' | 'lock-closed-outline' => {
    switch (biometricType) {
      case 'facial':
        return 'scan-outline';
      case 'fingerprint':
        return 'finger-print-outline';
      default:
        return 'lock-closed-outline';
    }
  };

  const getLabel = () => {
    switch (biometricType) {
      case 'facial':
        return 'Face ID';
      case 'fingerprint':
        return 'Touch ID';
      default:
        return 'Biometrics';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.content}>
        {/* App branding */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: themeColors.primary + '20' }]}>
            <Ionicons name="heart" size={48} color={themeColors.primary} />
          </View>
          <Text style={[styles.title, { color: themeColors.text }]}>HealthTracker</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            App is locked
          </Text>
        </View>

        {/* Lock icon and unlock button */}
        <View style={styles.lockSection}>
          <View style={[styles.lockCircle, { backgroundColor: themeColors.surface }]}>
            <Ionicons name={getIcon()} size={64} color={themeColors.primary} />
          </View>

          <TouchableOpacity
            style={[styles.unlockButton, { backgroundColor: themeColors.primary }]}
            onPress={handleAuthenticate}
            activeOpacity={0.8}
          >
            <Ionicons name={getIcon()} size={24} color="#fff" />
            <Text style={styles.unlockText}>Unlock with {getLabel()}</Text>
          </TouchableOpacity>
        </View>

        {/* Help text */}
        <Text style={[styles.helpText, { color: themeColors.textSecondary }]}>
          Tap the button above or use {getLabel()} to unlock
        </Text>

        {/* Emergency bypass - always visible */}
        <TouchableOpacity
          style={[styles.bypassButton, { borderColor: themeColors.textSecondary }]}
          onPress={handleEmergencyBypass}
          activeOpacity={0.7}
        >
          <Text style={[styles.bypassText, { color: themeColors.textSecondary }]}>
            Having trouble? Disable biometric lock
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  lockSection: {
    alignItems: 'center',
  },
  lockCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 12,
    minWidth: width * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  unlockText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    marginTop: 40,
    textAlign: 'center',
  },
  bypassButton: {
    marginTop: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 8,
  },
  bypassText: {
    fontSize: 14,
  },
});
