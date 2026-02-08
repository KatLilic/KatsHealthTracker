// Cloud Sync Service - Syncs local SQLite data with AWS DynamoDB via API Gateway
import { get, post, put, del } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getWeightEntries,
  getMeasurements,
  getZepboundShots,
  getUserProfile,
  addWeightEntry,
  addMeasurement,
  addZepboundShot,
  updateUserProfile,
  getNutritionHistory,
  upsertDailyNutrition,
  DailyNutrition,
} from '../database/db';
import { isAWSConfigured } from './amplifyConfigure';

const API_NAME = 'healthTrackerApi';
const LAST_SYNC_KEY = '@healthtracker_last_sync';

interface SyncResult {
  success: boolean;
  itemsSynced: number;
  error?: string;
}

// Get last sync timestamp
export const getLastSyncTime = async (): Promise<Date | null> => {
  const timestamp = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return timestamp ? new Date(timestamp) : null;
};

// Set last sync timestamp
const setLastSyncTime = async () => {
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
};

// Check if user is authenticated and AWS is configured
const canSync = async (): Promise<boolean> => {
  if (!isAWSConfigured()) return false;
  
  try {
    const session = await fetchAuthSession();
    return !!session.tokens;
  } catch {
    return false;
  }
};

// Sync all data to cloud
export const syncToCloud = async (): Promise<SyncResult> => {
  if (!(await canSync())) {
    return { success: false, itemsSynced: 0, error: 'Not authenticated or AWS not configured' };
  }

  try {
    const [weights, measurements, shots, profile, nutrition] = await Promise.all([
      getWeightEntries(),
      getMeasurements(),
      getZepboundShots(),
      getUserProfile(),
      getNutritionHistory(365), // Get last year of nutrition data
    ]);

    const lastSync = await getLastSyncTime();
    const lastSyncTime = lastSync?.getTime() || 0;

    // Filter items modified after last sync
    const newWeights = weights.filter(w => new Date(w.date).getTime() > lastSyncTime);
    const newMeasurements = measurements.filter(m => new Date(m.date).getTime() > lastSyncTime);
    const newShots = shots.filter(s => new Date(s.date).getTime() > lastSyncTime);
    const newNutrition = nutrition.filter(n => new Date(n.date).getTime() > lastSyncTime);

    // Upload to cloud
    const response = await post({
      apiName: API_NAME,
      path: '/sync',
      options: {
        body: JSON.stringify({
          weights: newWeights,
          measurements: newMeasurements,
          zepboundShots: newShots,
          nutrition: newNutrition,
          profile,
          lastSyncTime: lastSync?.toISOString(),
        }) as any,
      },
    });

    await setLastSyncTime();

    return {
      success: true,
      itemsSynced: newWeights.length + newMeasurements.length + newShots.length,
    };
  } catch (error: any) {
    console.error('Sync to cloud failed:', error);
    return {
      success: false,
      itemsSynced: 0,
      error: error.message || 'Sync failed',
    };
  }
};

// Sync from cloud to local
export const syncFromCloud = async (): Promise<SyncResult> => {
  if (!(await canSync())) {
    return { success: false, itemsSynced: 0, error: 'Not authenticated or AWS not configured' };
  }

  try {
    const lastSync = await getLastSyncTime();

    const response = await get({
      apiName: API_NAME,
      path: '/sync',
      options: {
        queryParams: {
          since: lastSync?.toISOString() || '',
        },
      },
    });

    const data = await (response as any).response;
    const body = await data.body.json();

    let itemsSynced = 0;

    // Import weights
    if (body.weights?.length) {
      for (const weight of body.weights) {
        await addWeightEntry(weight.weight_kg, weight.date, weight.notes);
        itemsSynced++;
      }
    }

    // Import measurements
    if (body.measurements?.length) {
      for (const m of body.measurements) {
        await addMeasurement({
          date: m.date,
          waist_cm: m.waist_cm,
          hips_cm: m.hips_cm,
          chest_cm: m.chest_cm,
          left_arm_cm: m.left_arm_cm,
          right_arm_cm: m.right_arm_cm,
          left_thigh_cm: m.left_thigh_cm,
          right_thigh_cm: m.right_thigh_cm,
          neck_cm: m.neck_cm,
          notes: m.notes,
        });
        itemsSynced++;
      }
    }

    // Import Zepbound shots
    if (body.zepboundShots?.length) {
      for (const shot of body.zepboundShots) {
        await addZepboundShot(shot.dose_mg, shot.date, shot.site, shot.notes);
        itemsSynced++;
      }
    }

    // Import nutrition data
    if (body.nutrition?.length) {
      for (const n of body.nutrition) {
        await upsertDailyNutrition(n.date, n.protein_g, n.calories, n.water_oz, n.notes);
        itemsSynced++;
      }
    }

    // Import profile
    if (body.profile) {
      await updateUserProfile(
        body.profile.name || '',
        body.profile.height_cm || 0,
        body.profile.goal_weight_kg || 0
      );
    }

    await setLastSyncTime();

    return { success: true, itemsSynced };
  } catch (error: any) {
    console.error('Sync from cloud failed:', error);
    return {
      success: false,
      itemsSynced: 0,
      error: error.message || 'Sync failed',
    };
  }
};

// Full two-way sync
export const syncAll = async (): Promise<SyncResult> => {
  // First push local changes
  const pushResult = await syncToCloud();
  if (!pushResult.success) return pushResult;

  // Then pull cloud changes
  const pullResult = await syncFromCloud();
  
  return {
    success: pullResult.success,
    itemsSynced: pushResult.itemsSynced + pullResult.itemsSynced,
    error: pullResult.error,
  };
};

// Delete all cloud data (for account deletion)
export const deleteCloudData = async (): Promise<boolean> => {
  if (!(await canSync())) return false;

  try {
    await del({
      apiName: API_NAME,
      path: '/sync',
    });
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
    return true;
  } catch (error) {
    console.error('Failed to delete cloud data:', error);
    return false;
  }
};
