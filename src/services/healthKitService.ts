// Apple Health (HealthKit) Integration Service
// NOTE: This requires a custom Expo development build with expo-dev-client
// Run: npx expo install react-native-health expo-dev-client
// Then: npx expo prebuild && npx expo run:ios

import AsyncStorage from '@react-native-async-storage/async-storage';

const HEALTH_KIT_ENABLED_KEY = '@health_tracker_healthkit_enabled';
const HEALTH_KIT_SYNC_DATE_KEY = '@health_tracker_healthkit_last_sync';

export interface HealthKitData {
  weight?: number; // in kg
  height?: number; // in cm
  bodyFat?: number; // percentage
  waist?: number; // in cm
  date?: string;
}

// Check if HealthKit is available (iOS only)
export const isHealthKitAvailable = async (): Promise<boolean> => {
  try {
    // Check if we're on iOS
    const { Platform } = require('react-native');
    if (Platform.OS !== 'ios') {
      return false;
    }
    
    // Try to load the health module
    const AppleHealthKit = require('react-native-health').default;
    if (!AppleHealthKit) {
      return false;
    }
    
    return true;
  } catch (error) {
    // Module not installed or not available in Expo Go
    console.log('HealthKit not available:', error);
    return false;
  }
};

// Check if HealthKit is enabled in settings
export const isHealthKitEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(HEALTH_KIT_ENABLED_KEY);
    return enabled === 'true';
  } catch {
    return false;
  }
};

// Enable/disable HealthKit sync
export const setHealthKitEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(HEALTH_KIT_ENABLED_KEY, enabled ? 'true' : 'false');
};

// Get last sync date
export const getLastSyncDate = async (): Promise<Date | null> => {
  try {
    const date = await AsyncStorage.getItem(HEALTH_KIT_SYNC_DATE_KEY);
    return date ? new Date(date) : null;
  } catch {
    return null;
  }
};

// Request HealthKit permissions
export const requestHealthKitPermissions = async (): Promise<boolean> => {
  try {
    const AppleHealthKit = require('react-native-health').default;
    const { HealthKitDataType, HealthPermission } = require('react-native-health');
    
    const permissions = {
      permissions: {
        read: [
          HealthKitDataType.Weight,
          HealthKitDataType.Height,
          HealthKitDataType.BodyFatPercentage,
          HealthKitDataType.WaistCircumference,
        ],
        write: [
          HealthKitDataType.Weight,
          HealthKitDataType.BodyFatPercentage,
          HealthKitDataType.WaistCircumference,
        ],
      },
    };
    
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, (error: any) => {
        if (error) {
          console.log('HealthKit init error:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.log('HealthKit permission error:', error);
    return false;
  }
};

// Read weight from HealthKit
export const readWeightFromHealthKit = async (days: number = 30): Promise<HealthKitData[]> => {
  try {
    const AppleHealthKit = require('react-native-health').default;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const options = {
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      ascending: false,
      limit: 100,
    };
    
    return new Promise((resolve) => {
      AppleHealthKit.getWeightSamples(options, (err: any, results: any[]) => {
        if (err) {
          console.log('Error reading weight:', err);
          resolve([]);
          return;
        }
        
        const data: HealthKitData[] = results.map((sample) => ({
          weight: sample.value * 0.453592, // Convert lbs to kg
          date: sample.startDate,
        }));
        
        resolve(data);
      });
    });
  } catch (error) {
    console.log('HealthKit read error:', error);
    return [];
  }
};

// Write weight to HealthKit
export const writeWeightToHealthKit = async (weightKg: number, date?: Date): Promise<boolean> => {
  try {
    const AppleHealthKit = require('react-native-health').default;
    
    const options = {
      value: weightKg * 2.20462, // Convert kg to lbs (HealthKit uses lbs)
      date: (date || new Date()).toISOString(),
    };
    
    return new Promise((resolve) => {
      AppleHealthKit.saveWeight(options, (err: any, result: any) => {
        if (err) {
          console.log('Error writing weight:', err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.log('HealthKit write error:', error);
    return false;
  }
};

// Read height from HealthKit
export const readHeightFromHealthKit = async (): Promise<number | null> => {
  try {
    const AppleHealthKit = require('react-native-health').default;
    
    return new Promise((resolve) => {
      AppleHealthKit.getLatestHeight({}, (err: any, result: any) => {
        if (err || !result) {
          resolve(null);
          return;
        }
        // Convert from inches to cm
        resolve(result.value * 2.54);
      });
    });
  } catch (error) {
    console.log('HealthKit height read error:', error);
    return null;
  }
};

// Sync data with HealthKit
export const syncWithHealthKit = async (): Promise<{
  imported: number;
  exported: number;
  error?: string;
}> => {
  try {
    const isAvailable = await isHealthKitAvailable();
    if (!isAvailable) {
      return { imported: 0, exported: 0, error: 'HealthKit not available' };
    }
    
    const hasPermission = await requestHealthKitPermissions();
    if (!hasPermission) {
      return { imported: 0, exported: 0, error: 'HealthKit permissions denied' };
    }
    
    // Read recent weight data
    const healthKitWeights = await readWeightFromHealthKit(30);
    
    // Update last sync date
    await AsyncStorage.setItem(HEALTH_KIT_SYNC_DATE_KEY, new Date().toISOString());
    
    return {
      imported: healthKitWeights.length,
      exported: 0, // Would need to implement export logic
    };
  } catch (error: any) {
    return { imported: 0, exported: 0, error: error?.message || 'Sync failed' };
  }
};

// Utility function for mock mode (Expo Go testing)
export const getMockHealthKitData = (): HealthKitData[] => {
  // Return mock data for testing in Expo Go
  const today = new Date();
  return [
    { weight: 75.5, date: today.toISOString() },
    { weight: 75.8, date: new Date(today.getTime() - 86400000).toISOString() },
    { weight: 76.0, date: new Date(today.getTime() - 86400000 * 2).toISOString() },
  ];
};
