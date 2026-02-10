/**
 * Historical Sample Data for ORBIS Health Tracker
 * 
 * This file contains realistic sample data for testing and development purposes.
 * It includes weight entries, measurements, medication tracking, and nutrition logs
 * spanning several months to demonstrate the full functionality of the app.
 */

import { WeightEntry, MeasurementEntry, ZepboundEntry, DailyNutrition } from '../../database/db';

/**
 * Sample User Profile
 * Height: 5'5" (165cm)
 * Starting Weight: ~90kg (198 lbs)
 * Goal Weight: 70kg (154 lbs)
 */
export const sampleUserProfile = {
  name: 'Kat',
  height_cm: 165,
  goal_weight_kg: 70,
};

/**
 * Sample Weight Entries - 6 months of data
 * Demonstrates gradual weight loss journey with Zepbound medication
 */
export const sampleWeightEntries: Omit<WeightEntry, 'id'>[] = [
  // August 2025 - Starting weight
  { weight_kg: 90.2, date: '2025-08-01', notes: 'Starting my journey!', protein_g: 65 },
  { weight_kg: 90.0, date: '2025-08-05', notes: null, protein_g: 70 },
  { weight_kg: 89.5, date: '2025-08-10', notes: 'First week complete', protein_g: 75 },
  { weight_kg: 89.2, date: '2025-08-15', notes: null, protein_g: 68 },
  { weight_kg: 88.8, date: '2025-08-20', notes: 'Feeling good!', protein_g: 80 },
  { weight_kg: 88.3, date: '2025-08-25', notes: null, protein_g: 72 },
  { weight_kg: 87.9, date: '2025-08-31', notes: 'First month done!', protein_g: 85 },
  
  // September 2025
  { weight_kg: 87.5, date: '2025-09-05', notes: null, protein_g: 78 },
  { weight_kg: 87.0, date: '2025-09-10', notes: 'Increased dose today', protein_g: 82 },
  { weight_kg: 86.5, date: '2025-09-15', notes: null, protein_g: 75 },
  { weight_kg: 86.0, date: '2025-09-20', notes: 'Down 4kg!', protein_g: 88 },
  { weight_kg: 85.5, date: '2025-09-25', notes: null, protein_g: 80 },
  { weight_kg: 85.0, date: '2025-09-30', notes: 'Two months in', protein_g: 85 },
  
  // October 2025
  { weight_kg: 84.5, date: '2025-10-05', notes: null, protein_g: 82 },
  { weight_kg: 84.2, date: '2025-10-10', notes: 'Plateau this week', protein_g: 78 },
  { weight_kg: 84.0, date: '2025-10-15', notes: null, protein_g: 80 },
  { weight_kg: 83.5, date: '2025-10-20', notes: 'Breaking through!', protein_g: 90 },
  { weight_kg: 83.0, date: '2025-10-25', notes: null, protein_g: 85 },
  { weight_kg: 82.5, date: '2025-10-31', notes: 'Halloween treats in moderation', protein_g: 75 },
  
  // November 2025
  { weight_kg: 82.0, date: '2025-11-05', notes: null, protein_g: 88 },
  { weight_kg: 81.5, date: '2025-11-10', notes: 'Feeling strong', protein_g: 92 },
  { weight_kg: 81.0, date: '2025-11-15', notes: null, protein_g: 85 },
  { weight_kg: 80.5, date: '2025-11-20', notes: 'Almost 10kg down!', protein_g: 90 },
  { weight_kg: 80.0, date: '2025-11-25', notes: null, protein_g: 87 },
  { weight_kg: 79.5, date: '2025-11-30', notes: 'Thanksgiving week', protein_g: 80 },
  
  // December 2025
  { weight_kg: 79.2, date: '2025-12-05', notes: null, protein_g: 85 },
  { weight_kg: 78.8, date: '2025-12-10', notes: 'Holiday season challenges', protein_g: 82 },
  { weight_kg: 78.5, date: '2025-12-15', notes: null, protein_g: 88 },
  { weight_kg: 78.2, date: '2025-12-20', notes: 'Staying consistent', protein_g: 90 },
  { weight_kg: 78.0, date: '2025-12-25', notes: 'Merry Christmas!', protein_g: 75 },
  { weight_kg: 77.8, date: '2025-12-31', notes: 'Year end - 12kg lost!', protein_g: 80 },
  
  // January 2026
  { weight_kg: 77.5, date: '2026-01-05', notes: 'New year momentum', protein_g: 95 },
  { weight_kg: 77.0, date: '2026-01-10', notes: null, protein_g: 88 },
  { weight_kg: 76.5, date: '2026-01-15', notes: 'Halfway to goal!', protein_g: 92 },
  { weight_kg: 76.2, date: '2026-01-20', notes: null, protein_g: 90 },
  { weight_kg: 75.8, date: '2026-01-25', notes: null, protein_g: 85 },
  { weight_kg: 75.5, date: '2026-01-31', notes: 'Consistent progress', protein_g: 88 },
  
  // February 2026 (current)
  { weight_kg: 75.0, date: '2026-02-05', notes: null, protein_g: 92 },
  { weight_kg: 74.5, date: '2026-02-09', notes: 'Feeling amazing!', protein_g: 95 },
];

/**
 * Sample Zepbound Medication Entries
 * Shows dose escalation protocol from 2.5mg to maintenance dose
 */
export const sampleZepboundEntries: Omit<ZepboundEntry, 'id'>[] = [
  // Starting dose - 2.5mg
  { date: '2025-08-01', dose_mg: 2.5, injection_site: 'Abdomen', side_effects: 'Mild nausea', notes: 'First dose!' },
  { date: '2025-08-08', dose_mg: 2.5, injection_site: 'Thigh', side_effects: null, notes: null },
  { date: '2025-08-15', dose_mg: 2.5, injection_site: 'Abdomen', side_effects: null, notes: null },
  { date: '2025-08-22', dose_mg: 2.5, injection_site: 'Arm', side_effects: null, notes: 'Tolerating well' },
  
  // Escalation to 5mg
  { date: '2025-08-29', dose_mg: 5.0, injection_site: 'Abdomen', side_effects: 'Nausea, decreased appetite', notes: 'Dose increase' },
  { date: '2025-09-05', dose_mg: 5.0, injection_site: 'Thigh', side_effects: 'Mild nausea', notes: null },
  { date: '2025-09-12', dose_mg: 5.0, injection_site: 'Abdomen', side_effects: null, notes: 'Adjusting well' },
  { date: '2025-09-19', dose_mg: 5.0, injection_site: 'Arm', side_effects: null, notes: null },
  { date: '2025-09-26', dose_mg: 5.0, injection_site: 'Thigh', side_effects: null, notes: null },
  
  // Escalation to 7.5mg
  { date: '2025-10-03', dose_mg: 7.5, injection_site: 'Abdomen', side_effects: 'Nausea first day', notes: 'Another increase' },
  { date: '2025-10-10', dose_mg: 7.5, injection_site: 'Thigh', side_effects: null, notes: null },
  { date: '2025-10-17', dose_mg: 7.5, injection_site: 'Arm', side_effects: null, notes: null },
  { date: '2025-10-24', dose_mg: 7.5, injection_site: 'Abdomen', side_effects: null, notes: null },
  { date: '2025-10-31', dose_mg: 7.5, injection_site: 'Thigh', side_effects: null, notes: null },
  
  // Escalation to 10mg
  { date: '2025-11-07', dose_mg: 10.0, injection_site: 'Abdomen', side_effects: 'Moderate nausea', notes: 'Dose increase to 10mg' },
  { date: '2025-11-14', dose_mg: 10.0, injection_site: 'Thigh', side_effects: 'Mild nausea', notes: null },
  { date: '2025-11-21', dose_mg: 10.0, injection_site: 'Arm', side_effects: null, notes: 'Feeling good' },
  { date: '2025-11-28', dose_mg: 10.0, injection_site: 'Abdomen', side_effects: null, notes: null },
  
  // Maintenance at 10mg
  { date: '2025-12-05', dose_mg: 10.0, injection_site: 'Thigh', side_effects: null, notes: 'Staying at this dose' },
  { date: '2025-12-12', dose_mg: 10.0, injection_site: 'Abdomen', side_effects: null, notes: null },
  { date: '2025-12-19', dose_mg: 10.0, injection_site: 'Arm', side_effects: null, notes: null },
  { date: '2025-12-26', dose_mg: 10.0, injection_site: 'Thigh', side_effects: null, notes: null },
  
  // January 2026
  { date: '2026-01-02', dose_mg: 10.0, injection_site: 'Abdomen', side_effects: null, notes: null },
  { date: '2026-01-09', dose_mg: 10.0, injection_site: 'Thigh', side_effects: null, notes: null },
  { date: '2026-01-16', dose_mg: 10.0, injection_site: 'Arm', side_effects: null, notes: null },
  { date: '2026-01-23', dose_mg: 10.0, injection_site: 'Abdomen', side_effects: null, notes: null },
  { date: '2026-01-30', dose_mg: 10.0, injection_site: 'Thigh', side_effects: null, notes: null },
  
  // February 2026
  { date: '2026-02-06', dose_mg: 10.0, injection_site: 'Abdomen', side_effects: null, notes: null },
];

/**
 * Sample Body Measurements
 * Tracked monthly to show body composition changes
 */
export const sampleMeasurements: Omit<MeasurementEntry, 'id'>[] = [
  // August 2025 - Baseline
  {
    date: '2025-08-01',
    chest_cm: 102,
    rib_cage_cm: 90,
    waist_cm: 95,
    lower_belly_cm: 105,
    hips_cm: 115,
    left_arm_cm: 32,
    right_arm_cm: 32,
    left_wrist_cm: 16,
    right_wrist_cm: 16,
    left_thigh_cm: 62,
    right_thigh_cm: 62,
    left_calf_cm: 38,
    right_calf_cm: 38,
    neck_cm: 35,
    notes: 'Starting measurements',
  },
  
  // September 2025
  {
    date: '2025-09-01',
    chest_cm: 100,
    rib_cage_cm: 89,
    waist_cm: 93,
    lower_belly_cm: 103,
    hips_cm: 113,
    left_arm_cm: 31.5,
    right_arm_cm: 31.5,
    left_wrist_cm: 16,
    right_wrist_cm: 16,
    left_thigh_cm: 61,
    right_thigh_cm: 61,
    left_calf_cm: 37.5,
    right_calf_cm: 37.5,
    neck_cm: 34.5,
    notes: 'One month progress',
  },
  
  // October 2025
  {
    date: '2025-10-01',
    chest_cm: 98,
    rib_cage_cm: 88,
    waist_cm: 91,
    lower_belly_cm: 101,
    hips_cm: 111,
    left_arm_cm: 31,
    right_arm_cm: 31,
    left_wrist_cm: 15.5,
    right_wrist_cm: 15.5,
    left_thigh_cm: 60,
    right_thigh_cm: 60,
    left_calf_cm: 37,
    right_calf_cm: 37,
    neck_cm: 34,
    notes: 'Visible changes!',
  },
  
  // November 2025
  {
    date: '2025-11-01',
    chest_cm: 96,
    rib_cage_cm: 87,
    waist_cm: 89,
    lower_belly_cm: 98,
    hips_cm: 109,
    left_arm_cm: 30.5,
    right_arm_cm: 30.5,
    left_wrist_cm: 15.5,
    right_wrist_cm: 15.5,
    left_thigh_cm: 59,
    right_thigh_cm: 59,
    left_calf_cm: 36.5,
    right_calf_cm: 36.5,
    neck_cm: 33.5,
    notes: 'Lost 10cm from waist!',
  },
  
  // December 2025
  {
    date: '2025-12-01',
    chest_cm: 94,
    rib_cage_cm: 86,
    waist_cm: 87,
    lower_belly_cm: 96,
    hips_cm: 107,
    left_arm_cm: 30,
    right_arm_cm: 30,
    left_wrist_cm: 15.5,
    right_wrist_cm: 15.5,
    left_thigh_cm: 58,
    right_thigh_cm: 58,
    left_calf_cm: 36,
    right_calf_cm: 36,
    neck_cm: 33,
    notes: 'Great progress',
  },
  
  // January 2026
  {
    date: '2026-01-01',
    chest_cm: 92,
    rib_cage_cm: 85,
    waist_cm: 85,
    lower_belly_cm: 94,
    hips_cm: 105,
    left_arm_cm: 29.5,
    right_arm_cm: 29.5,
    left_wrist_cm: 15,
    right_wrist_cm: 15,
    left_thigh_cm: 57,
    right_thigh_cm: 57,
    left_calf_cm: 35.5,
    right_calf_cm: 35.5,
    neck_cm: 32.5,
    notes: 'New year, new me!',
  },
  
  // February 2026
  {
    date: '2026-02-01',
    chest_cm: 90,
    rib_cage_cm: 84,
    waist_cm: 83,
    lower_belly_cm: 92,
    hips_cm: 103,
    left_arm_cm: 29,
    right_arm_cm: 29,
    left_wrist_cm: 15,
    right_wrist_cm: 15,
    left_thigh_cm: 56,
    right_thigh_cm: 56,
    left_calf_cm: 35,
    right_calf_cm: 35,
    neck_cm: 32,
    notes: 'Halfway to goal!',
  },
];

/**
 * Sample Daily Nutrition Entries
 * For days when weight wasn't logged but nutrition was tracked
 */
export const sampleNutritionEntries: Omit<DailyNutrition, 'id' | 'created_at'>[] = [
  { date: '2025-08-03', protein_g: 72, calories: 1400, water_oz: 64, notes: 'Good hydration day' },
  { date: '2025-08-07', protein_g: 68, calories: 1350, water_oz: 60, notes: null },
  { date: '2025-08-13', protein_g: 78, calories: 1450, water_oz: 72, notes: 'Added protein shake' },
  { date: '2025-09-03', protein_g: 80, calories: 1380, water_oz: 68, notes: null },
  { date: '2025-09-08', protein_g: 75, calories: 1420, water_oz: 70, notes: null },
  { date: '2025-10-08', protein_g: 85, calories: 1400, water_oz: 75, notes: 'Feeling satiated' },
  { date: '2025-11-03', protein_g: 88, calories: 1450, water_oz: 72, notes: null },
  { date: '2025-12-08', protein_g: 82, calories: 1380, water_oz: 68, notes: 'Holiday prep' },
  { date: '2026-01-03', protein_g: 90, calories: 1500, water_oz: 80, notes: 'Great start to year' },
];

/**
 * Helper function to load sample data into the database
 * Use this in development/testing to populate the app with realistic data
 */
export async function loadSampleData(db: any) {
  console.log('Loading sample data...');
  
  try {
    // Clear existing data (optional)
    // await db.execAsync('DELETE FROM weight_entries');
    // await db.execAsync('DELETE FROM measurements');
    // await db.execAsync('DELETE FROM zepbound_shots');
    // await db.execAsync('DELETE FROM daily_nutrition');
    
    // Load weight entries
    for (const entry of sampleWeightEntries) {
      await db.runAsync(
        'INSERT INTO weight_entries (weight_kg, date, notes, protein_g) VALUES (?, ?, ?, ?)',
        [entry.weight_kg, entry.date, entry.notes, entry.protein_g]
      );
    }
    
    // Load measurements
    for (const entry of sampleMeasurements) {
      await db.runAsync(
        `INSERT INTO measurements (date, chest_cm, rib_cage_cm, waist_cm, lower_belly_cm, hips_cm, 
          left_arm_cm, right_arm_cm, left_wrist_cm, right_wrist_cm, left_thigh_cm, right_thigh_cm, 
          left_calf_cm, right_calf_cm, neck_cm, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.date, entry.chest_cm, entry.rib_cage_cm, entry.waist_cm, entry.lower_belly_cm,
          entry.hips_cm, entry.left_arm_cm, entry.right_arm_cm, entry.left_wrist_cm,
          entry.right_wrist_cm, entry.left_thigh_cm, entry.right_thigh_cm, entry.left_calf_cm,
          entry.right_calf_cm, entry.neck_cm, entry.notes
        ]
      );
    }
    
    // Load Zepbound shots
    for (const entry of sampleZepboundEntries) {
      await db.runAsync(
        'INSERT INTO zepbound_shots (date, dose_mg, injection_site, side_effects, notes) VALUES (?, ?, ?, ?, ?)',
        [entry.date, entry.dose_mg, entry.injection_site, entry.side_effects, entry.notes]
      );
    }
    
    // Load nutrition entries
    for (const entry of sampleNutritionEntries) {
      await db.runAsync(
        'INSERT INTO daily_nutrition (date, protein_g, calories, water_oz, notes) VALUES (?, ?, ?, ?, ?)',
        [entry.date, entry.protein_g, entry.calories, entry.water_oz, entry.notes]
      );
    }
    
    console.log('Sample data loaded successfully!');
    console.log(`- ${sampleWeightEntries.length} weight entries`);
    console.log(`- ${sampleMeasurements.length} measurement entries`);
    console.log(`- ${sampleZepboundEntries.length} Zepbound shots`);
    console.log(`- ${sampleNutritionEntries.length} nutrition entries`);
    
    return true;
  } catch (error) {
    console.error('Error loading sample data:', error);
    return false;
  }
}
