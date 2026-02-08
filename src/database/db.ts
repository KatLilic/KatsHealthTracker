import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('healthtracker.db');

export async function initDatabase() {
  // Create tables
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    -- User profile table
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      height_cm REAL,
      goal_weight_kg REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Weight entries table (includes protein tracking)
    CREATE TABLE IF NOT EXISTS weight_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      protein_g REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Zepbound shots table
    CREATE TABLE IF NOT EXISTS zepbound_shots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      dose_mg REAL NOT NULL,
      injection_site TEXT,
      side_effects TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Daily nutrition log (for days without weight entries)
    CREATE TABLE IF NOT EXISTS daily_nutrition (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      protein_g REAL,
      calories REAL,
      water_oz REAL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Add initial profile if not exists
    INSERT OR IGNORE INTO user_profile (id, name, height_cm, goal_weight_kg) 
    VALUES (1, '', 165, 70);
  `);
  
  // Add protein_g column to weight_entries if it doesn't exist
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(weight_entries)`);
    const columns = tableInfo.map(col => col.name);
    if (!columns.includes('protein_g')) {
      await db.execAsync(`ALTER TABLE weight_entries ADD COLUMN protein_g REAL`);
    }
  } catch (e) {
    console.log('Could not add protein_g column:', e);
  }
  
  // Check if measurements table needs to be recreated (schema migration)
  // Get existing column names
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(measurements)`);
    const columns = tableInfo.map(col => col.name);
    
    // Check if essential columns exist
    const requiredColumns = ['rib_cage_cm', 'waist_cm', 'lower_belly_cm', 'hips_cm', 'left_arm_cm', 'right_arm_cm'];
    const needsMigration = requiredColumns.some(col => !columns.includes(col));
    
    if (needsMigration || columns.length === 0) {
      // Table has old schema or doesn't exist - recreate it
      await db.execAsync(`DROP TABLE IF EXISTS measurements`);
      await db.execAsync(`
        CREATE TABLE measurements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          chest_cm REAL,
          rib_cage_cm REAL,
          waist_cm REAL,
          lower_belly_cm REAL,
          hips_cm REAL,
          left_arm_cm REAL,
          right_arm_cm REAL,
          left_wrist_cm REAL,
          right_wrist_cm REAL,
          left_thigh_cm REAL,
          right_thigh_cm REAL,
          left_calf_cm REAL,
          right_calf_cm REAL,
          neck_cm REAL,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
  } catch (e) {
    // Table doesn't exist - create it
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        chest_cm REAL,
        rib_cage_cm REAL,
        waist_cm REAL,
        lower_belly_cm REAL,
        hips_cm REAL,
        left_arm_cm REAL,
        right_arm_cm REAL,
        left_wrist_cm REAL,
        right_wrist_cm REAL,
        left_thigh_cm REAL,
        right_thigh_cm REAL,
        left_calf_cm REAL,
        right_calf_cm REAL,
        neck_cm REAL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

// User Profile functions
export async function getUserProfile() {
  const result = await db.getFirstAsync<{
    id: number;
    name: string;
    height_cm: number;
    goal_weight_kg: number;
  }>('SELECT * FROM user_profile WHERE id = 1');
  return result;
}

export async function updateUserProfile(name: string, heightCm: number, goalWeightKg: number) {
  await db.runAsync(
    'UPDATE user_profile SET name = ?, height_cm = ?, goal_weight_kg = ? WHERE id = 1',
    [name, heightCm, goalWeightKg]
  );
}

// Weight functions
export interface WeightEntry {
  id: number;
  weight_kg: number;
  date: string;
  notes: string | null;
  protein_g: number | null;
}

export async function addWeightEntry(weightKg: number, date: string, notes?: string, proteinG?: number) {
  const result = await db.runAsync(
    'INSERT INTO weight_entries (weight_kg, date, notes, protein_g) VALUES (?, ?, ?, ?)',
    [weightKg, date, notes || null, proteinG || null]
  );
  return result.lastInsertRowId;
}

export async function getWeightEntries(limit?: number): Promise<WeightEntry[]> {
  const query = limit 
    ? 'SELECT * FROM weight_entries ORDER BY date DESC LIMIT ?'
    : 'SELECT * FROM weight_entries ORDER BY date DESC';
  const params = limit ? [limit] : [];
  const result = await db.getAllAsync<WeightEntry>(query, params);
  return result;
}

export async function getWeightEntriesForChart(days: number = 30): Promise<WeightEntry[]> {
  const result = await db.getAllAsync<WeightEntry>(
    `SELECT * FROM weight_entries 
     WHERE date >= date('now', '-${days} days') 
     ORDER BY date ASC`
  );
  return result;
}

export async function deleteWeightEntry(id: number) {
  await db.runAsync('DELETE FROM weight_entries WHERE id = ?', [id]);
}

// Measurements functions
export interface MeasurementEntry {
  id: number;
  date: string;
  chest_cm: number | null;
  rib_cage_cm: number | null;
  waist_cm: number | null;
  lower_belly_cm: number | null;
  hips_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_wrist_cm: number | null;
  right_wrist_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  left_calf_cm: number | null;
  right_calf_cm: number | null;
  neck_cm: number | null;
  notes: string | null;
}

export async function addMeasurement(measurement: Partial<MeasurementEntry> & { date: string }) {
  const result = await db.runAsync(
    `INSERT INTO measurements (date, chest_cm, rib_cage_cm, waist_cm, lower_belly_cm, hips_cm, left_arm_cm, right_arm_cm, left_wrist_cm, right_wrist_cm, left_thigh_cm, right_thigh_cm, left_calf_cm, right_calf_cm, neck_cm, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      measurement.date,
      measurement.chest_cm || null,
      measurement.rib_cage_cm || null,
      measurement.waist_cm || null,
      measurement.lower_belly_cm || null,
      measurement.hips_cm || null,
      measurement.left_arm_cm || null,
      measurement.right_arm_cm || null,
      measurement.left_wrist_cm || null,
      measurement.right_wrist_cm || null,
      measurement.left_thigh_cm || null,
      measurement.right_thigh_cm || null,
      measurement.left_calf_cm || null,
      measurement.right_calf_cm || null,
      measurement.neck_cm || null,
      measurement.notes || null,
    ]
  );
  return result.lastInsertRowId;
}

export async function getMeasurements(limit?: number): Promise<MeasurementEntry[]> {
  const query = limit
    ? 'SELECT * FROM measurements ORDER BY date DESC LIMIT ?'
    : 'SELECT * FROM measurements ORDER BY date DESC';
  const params = limit ? [limit] : [];
  const result = await db.getAllAsync<MeasurementEntry>(query, params);
  return result;
}

export async function getLatestMeasurement(): Promise<MeasurementEntry | null> {
  const result = await db.getFirstAsync<MeasurementEntry>(
    'SELECT * FROM measurements ORDER BY date DESC LIMIT 1'
  );
  return result || null;
}

export async function deleteMeasurement(id: number) {
  await db.runAsync('DELETE FROM measurements WHERE id = ?', [id]);
}

// Zepbound functions
export interface ZepboundEntry {
  id: number;
  date: string;
  dose_mg: number;
  injection_site: string | null;
  side_effects: string | null;
  notes: string | null;
}

export async function addZepboundShot(
  date: string,
  doseMg: number,
  injectionSite?: string,
  sideEffects?: string,
  notes?: string
) {
  const result = await db.runAsync(
    'INSERT INTO zepbound_shots (date, dose_mg, injection_site, side_effects, notes) VALUES (?, ?, ?, ?, ?)',
    [date, doseMg, injectionSite || null, sideEffects || null, notes || null]
  );
  return result.lastInsertRowId;
}

export async function getZepboundShots(limit?: number): Promise<ZepboundEntry[]> {
  const query = limit
    ? 'SELECT * FROM zepbound_shots ORDER BY date DESC LIMIT ?'
    : 'SELECT * FROM zepbound_shots ORDER BY date DESC';
  const params = limit ? [limit] : [];
  const result = await db.getAllAsync<ZepboundEntry>(query, params);
  return result;
}

export async function getFirstZepboundShot(): Promise<ZepboundEntry | null> {
  const result = await db.getFirstAsync<ZepboundEntry>(
    'SELECT * FROM zepbound_shots ORDER BY date ASC LIMIT 1'
  );
  return result || null;
}

export async function deleteZepboundShot(id: number) {
  await db.runAsync('DELETE FROM zepbound_shots WHERE id = ?', [id]);
}

export async function getZepboundStats() {
  const totalShots = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM zepbound_shots'
  );
  const firstShot = await getFirstZepboundShot();
  const latestShot = await db.getFirstAsync<ZepboundEntry>(
    'SELECT * FROM zepbound_shots ORDER BY date DESC LIMIT 1'
  );
  
  // Get weight at first shot date and latest weight
  let weightLostSinceStart = 0;
  if (firstShot) {
    const firstWeight = await db.getFirstAsync<{ weight_kg: number }>(
      'SELECT weight_kg FROM weight_entries WHERE date <= ? ORDER BY date DESC LIMIT 1',
      [firstShot.date]
    );
    const latestWeight = await db.getFirstAsync<{ weight_kg: number }>(
      'SELECT weight_kg FROM weight_entries ORDER BY date DESC LIMIT 1'
    );
    if (firstWeight && latestWeight) {
      weightLostSinceStart = firstWeight.weight_kg - latestWeight.weight_kg;
    }
  }

  return {
    totalShots: totalShots?.count || 0,
    firstShotDate: firstShot?.date || null,
    latestShotDate: latestShot?.date || null,
    currentDose: latestShot?.dose_mg || null,
    weightLostSinceStart,
  };
}

// Daily Nutrition functions
export interface DailyNutrition {
  id: number;
  date: string;
  protein_g: number | null;
  calories: number | null;
  water_oz: number | null;
  notes: string | null;
}

export async function upsertDailyNutrition(date: string, proteinG?: number, calories?: number, waterOz?: number, notes?: string) {
  // Try to update first, then insert if not exists
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM daily_nutrition WHERE date = ?', [date]);
  
  if (existing) {
    await db.runAsync(
      `UPDATE daily_nutrition SET protein_g = COALESCE(?, protein_g), calories = COALESCE(?, calories), water_oz = COALESCE(?, water_oz), notes = COALESCE(?, notes) WHERE date = ?`,
      [proteinG || null, calories || null, waterOz || null, notes || null, date]
    );
    return existing.id;
  } else {
    const result = await db.runAsync(
      'INSERT INTO daily_nutrition (date, protein_g, calories, water_oz, notes) VALUES (?, ?, ?, ?, ?)',
      [date, proteinG || null, calories || null, waterOz || null, notes || null]
    );
    return result.lastInsertRowId;
  }
}

export async function getDailyNutrition(date: string): Promise<DailyNutrition | null> {
  return await db.getFirstAsync<DailyNutrition>('SELECT * FROM daily_nutrition WHERE date = ?', [date]);
}

export async function getNutritionHistory(days: number = 30): Promise<DailyNutrition[]> {
  return await db.getAllAsync<DailyNutrition>(
    `SELECT * FROM daily_nutrition WHERE date >= date('now', '-${days} days') ORDER BY date DESC`
  );
}

// Get protein data for a date range (combines weight_entries and daily_nutrition)
export async function getProteinHistory(days: number = 30): Promise<{ date: string; protein_g: number }[]> {
  // Get protein from both weight_entries and daily_nutrition
  const weightProtein = await db.getAllAsync<{ date: string; protein_g: number }>(
    `SELECT date, protein_g FROM weight_entries WHERE protein_g IS NOT NULL AND date >= date('now', '-${days} days')`
  );
  const nutritionProtein = await db.getAllAsync<{ date: string; protein_g: number }>(
    `SELECT date, protein_g FROM daily_nutrition WHERE protein_g IS NOT NULL AND date >= date('now', '-${days} days')`
  );
  
  // Merge and dedupe by date (prefer weight_entries)
  const proteinMap = new Map<string, number>();
  nutritionProtein.forEach(n => proteinMap.set(n.date, n.protein_g));
  weightProtein.forEach(w => proteinMap.set(w.date, w.protein_g)); // Override with weight entries
  
  return Array.from(proteinMap.entries())
    .map(([date, protein_g]) => ({ date, protein_g }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Get average protein for the last N days
export async function getAverageProtein(days: number = 7): Promise<number> {
  const history = await getProteinHistory(days);
  if (history.length === 0) return 0;
  return history.reduce((sum, h) => sum + h.protein_g, 0) / history.length;
}

// Clear all user data (for account reset)
export async function clearAllData() {
  await db.execAsync(`
    DELETE FROM weight_entries;
    DELETE FROM measurements;
    DELETE FROM zepbound_shots;
    DELETE FROM daily_nutrition;
    UPDATE user_profile SET name = '', height_cm = 165, goal_weight_kg = 70 WHERE id = 1;
  `);
}

// Get comprehensive stats for AI summary
export async function getComprehensiveStats() {
  const profile = await getUserProfile();
  const weights = await getWeightEntries();
  const measurements = await getMeasurements();
  const shots = await getZepboundShots();
  const avgProtein7 = await getAverageProtein(7);
  const avgProtein30 = await getAverageProtein(30);
  const proteinHistory = await getProteinHistory(30);
  
  // Calculate weight stats
  const latestWeight = weights[0]?.weight_kg || null;
  const firstWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg : null;
  const totalLost = firstWeight && latestWeight ? firstWeight - latestWeight : 0;
  
  // Weekly weight change
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];
  const weekAgoWeight = weights.find(w => w.date <= weekAgoStr)?.weight_kg;
  const weeklyChange = weekAgoWeight && latestWeight ? latestWeight - weekAgoWeight : null;
  
  // Monthly weight change
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const monthAgoStr = oneMonthAgo.toISOString().split('T')[0];
  const monthAgoWeight = weights.find(w => w.date <= monthAgoStr)?.weight_kg;
  const monthlyChange = monthAgoWeight && latestWeight ? latestWeight - monthAgoWeight : null;
  
  // BMI calculation
  const heightM = profile?.height_cm ? profile.height_cm / 100 : 1.65;
  const bmi = latestWeight ? latestWeight / (heightM * heightM) : null;
  
  // Zepbound stats
  const latestShot = shots[0];
  const firstShot = shots.length > 0 ? shots[shots.length - 1] : null;
  const totalWeeksOnMed = firstShot ? Math.floor((Date.now() - new Date(firstShot.date).getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0;
  
  // Measurement changes
  const latestMeasurement = measurements[0];
  const firstMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  
  return {
    profile: {
      name: profile?.name,
      heightCm: profile?.height_cm,
      goalWeight: profile?.goal_weight_kg,
    },
    weight: {
      current: latestWeight,
      first: firstWeight,
      totalLost,
      weeklyChange,
      monthlyChange,
      bmi,
      toGoal: latestWeight && profile?.goal_weight_kg ? latestWeight - profile.goal_weight_kg : null,
      totalEntries: weights.length,
    },
    nutrition: {
      avgProtein7Day: avgProtein7,
      avgProtein30Day: avgProtein30,
      proteinDaysTracked: proteinHistory.length,
      latestProtein: proteinHistory.length > 0 ? proteinHistory[proteinHistory.length - 1].protein_g : null,
    },
    medication: {
      currentDose: latestShot?.dose_mg || null,
      totalShots: shots.length,
      weeksOnMedication: totalWeeksOnMed,
      lastShotDate: latestShot?.date || null,
      recentSideEffects: latestShot?.side_effects || null,
    },
    measurements: {
      latest: latestMeasurement,
      first: firstMeasurement,
      totalEntries: measurements.length,
    },
  };
}

export default db;
