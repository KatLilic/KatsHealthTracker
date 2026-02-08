import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getUserProfile, updateUserProfile, clearAllData } from '../database/db';
import { useTheme, THEME_PRESETS, ThemePresetKey } from '../theme/ThemeContext';
import { useAuth } from '../aws/AuthContext';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import {
  isHealthKitAvailable,
  isHealthKitEnabled,
  setHealthKitEnabled,
  syncWithHealthKit,
  getLastSyncDate,
} from '../services/healthKitService';
import { useBiometric } from '../auth/BiometricContext';

const CHART_RANGE_OPTIONS = [
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
  { value: '365', label: '1 Year' },
] as const;

export default function SettingsScreen() {
  const { theme, themeColors, prefs, setTheme, updatePrefs, setCustomColors } = useTheme();
  const { user, isAuthenticated, isAWSEnabled, signOut, registerPasskey, listPasskeys, deletePasskey } = useAuth();
  const navigation = useNavigation<any>();

  const [name, setName] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);
  
  // Custom theme color state
  const [customPrimary, setCustomPrimary] = useState(prefs.customColors?.primary || '#E91E63');
  const [customSecondary, setCustomSecondary] = useState(prefs.customColors?.secondary || '#00BCD4');
  const [customAccent, setCustomAccent] = useState(prefs.customColors?.accent || '#FFC107');
  const [customBackground, setCustomBackground] = useState(prefs.customColors?.background || '#FAFAFA');

  // Preset color options for quick selection
  const COLOR_OPTIONS = [
    '#E91E63', '#F44336', '#FF5722', '#FF9800', '#FFC107', 
    '#4CAF50', '#009688', '#00BCD4', '#03A9F4', '#2196F3',
    '#3F51B5', '#673AB7', '#9C27B0', '#795548', '#607D8B',
  ];

  // Apple Health state
  const [healthKitAvailable, setHealthKitAvailable] = useState(false);
  const [healthKitEnabled, setHealthKitEnabledState] = useState(false);
  const [healthKitSyncing, setHealthKitSyncing] = useState(false);
  const [lastHealthKitSync, setLastHealthKitSync] = useState<Date | null>(null);

  // Clear data state
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [clearDataConfirmText, setClearDataConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAllData = async () => {
    if (clearDataConfirmText !== 'DELETE ALL') {
      Alert.alert('Error', 'Please type "DELETE ALL" to confirm');
      return;
    }
    
    setIsClearing(true);
    try {
      await clearAllData();
      setShowClearDataModal(false);
      setClearDataConfirmText('');
      setName('');
      setHeightFeet('');
      setHeightInches('');
      setGoalWeight('');
      Alert.alert('Success', 'All data has been cleared.');
    } catch (e) {
      Alert.alert('Error', 'Failed to clear data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const loadHealthKitStatus = async () => {
    const available = await isHealthKitAvailable();
    setHealthKitAvailable(available);
    if (available) {
      const enabled = await isHealthKitEnabled();
      setHealthKitEnabledState(enabled);
      const lastSync = await getLastSyncDate();
      setLastHealthKitSync(lastSync);
    }
  };

  const handleHealthKitToggle = async (enabled: boolean) => {
    if (enabled) {
      // Try to sync first to request permissions
      setHealthKitSyncing(true);
      const result = await syncWithHealthKit();
      setHealthKitSyncing(false);
      
      if (result.error) {
        Alert.alert(
          'Apple Health',
          result.error === 'HealthKit not available' 
            ? 'Apple Health requires a custom development build. This feature is not available in Expo Go.'
            : result.error
        );
        return;
      }
      
      await setHealthKitEnabled(true);
      setHealthKitEnabledState(true);
      setLastHealthKitSync(new Date());
      Alert.alert('Success', `Synced ${result.imported} weight entries from Apple Health!`);
    } else {
      await setHealthKitEnabled(false);
      setHealthKitEnabledState(false);
    }
  };

  const handleHealthKitSync = async () => {
    setHealthKitSyncing(true);
    const result = await syncWithHealthKit();
    setHealthKitSyncing(false);
    
    if (result.error) {
      Alert.alert('Sync Error', result.error);
    } else {
      setLastHealthKitSync(new Date());
      Alert.alert('Success', `Synced ${result.imported} weight entries from Apple Health!`);
    }
  };

  const loadPasskeys = async () => {
    if (!isAuthenticated) return;
    setIsLoadingPasskeys(true);
    try {
      const list = await listPasskeys();
      setPasskeys(list);
    } catch (e) {
      console.log('Failed to load passkeys:', e);
    } finally {
      setIsLoadingPasskeys(false);
    }
  };

  const handleRegisterPasskey = async () => {
    try {
      await registerPasskey();
      Alert.alert('Success', 'Passkey registered successfully!');
      loadPasskeys();
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to register passkey';
      // Check for common WebAuthn/Passkey issues
      if (errorMessage.includes('not supported') || errorMessage.includes('WebAuthn') || errorMessage.includes('native')) {
        Alert.alert(
          'Passkeys Not Available',
          'Passkey registration requires a custom development build. This feature is not available in Expo Go.'
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    Alert.alert(
      'Delete Passkey',
      'Are you sure you want to remove this passkey?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePasskey(credentialId);
              Alert.alert('Deleted', 'Passkey removed');
              loadPasskeys();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete passkey');
            }
          },
        },
      ]
    );
  };

  const handleSaveCustomColors = async () => {
    try {
      await setCustomColors({
        primary: customPrimary,
        secondary: customSecondary,
        accent: customAccent,
        background: customBackground,
      });
      Alert.alert('Success', 'Custom colors saved!');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save custom colors');
    }
  };

  const loadProfile = async () => {
    try {
      const profile = await getUserProfile();
      if (profile) {
        setName(profile.name || '');

        if (profile.height_cm) {
          const totalInches = profile.height_cm / 2.54;
          const feet = Math.floor(totalInches / 12);
          const inches = Math.round(totalInches % 12);
          setHeightFeet(feet.toString());
          setHeightInches(inches.toString());
        }

        if (profile.goal_weight_kg) {
          setGoalWeight((profile.goal_weight_kg * 2.205).toFixed(0));
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncAll();
      if (result.success) {
        Alert.alert('Synced!', `Successfully synced ${result.itemsSynced} items.`);
        setLastSync(new Date());
      } else {
        Alert.alert('Sync Failed', result.error || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sync data.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your local data will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadPasskeys();
      loadHealthKitStatus();
    }, [isAuthenticated])
  );

  const handleSave = async () => {
    try {
      const feet = parseInt(heightFeet) || 0;
      const inches = parseInt(heightInches) || 0;
      const heightCm = (feet * 12 + inches) * 2.54;

      const goalLbs = parseFloat(goalWeight) || 0;
      const goalKg = goalLbs / 2.205;

      await updateUserProfile(name, heightCm, goalKg);
      setHasChanges(false);
      Alert.alert('Saved!', 'Your profile has been updated.');
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    }
  };

  const handleChange = (setter: (val: string) => void) => (value: string) => {
    setter(value);
    setHasChanges(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} keyboardShouldPersistTaps="handled">
        {/* ====== PROFILE ====== */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color={themeColors.primary} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Profile</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.background, borderColor: themeColors.textSecondary, color: themeColors.text }]}
              value={name}
              onChangeText={handleChange(setName)}
              placeholder="Your name"
              placeholderTextColor={themeColors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Height</Text>
            <View style={styles.heightInputs}>
              <TextInput
                style={[styles.input, styles.heightInput, { backgroundColor: themeColors.background, borderColor: themeColors.textSecondary, color: themeColors.text }]}
                value={heightFeet}
                onChangeText={handleChange(setHeightFeet)}
                placeholder="5"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="number-pad"
                maxLength={1}
              />
              <Text style={[styles.heightLabel, { color: themeColors.textSecondary }]}>ft</Text>
              <TextInput
                style={[styles.input, styles.heightInput, { backgroundColor: themeColors.background, borderColor: themeColors.textSecondary, color: themeColors.text }]}
                value={heightInches}
                onChangeText={handleChange(setHeightInches)}
                placeholder="6"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={[styles.heightLabel, { color: themeColors.textSecondary }]}>in</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Goal Weight</Text>
            <View style={styles.goalInputContainer}>
              <TextInput
                style={[styles.input, styles.goalInput, { backgroundColor: themeColors.background, borderColor: themeColors.textSecondary, color: themeColors.text }]}
                value={goalWeight}
                onChangeText={handleChange(setGoalWeight)}
                placeholder="150"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.goalLabel, { color: themeColors.textSecondary }]}>lbs</Text>
            </View>
          </View>

          {hasChanges && (
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: themeColors.primary }]} onPress={handleSave}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ====== APPEARANCE ====== */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="color-palette-outline" size={20} color={themeColors.primary} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Appearance</Text>
          </View>
          <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
            Choose your app appearance and color themes
          </Text>

          {/* Light/Dark/Auto Mode Selector */}
          <View style={styles.themeModeContainer}>
            {(['light', 'dark', 'system'] as const).map((mode) => {
              const isActive = prefs.themeMode === mode;
              const label = mode === 'system' ? 'Auto' : mode.charAt(0).toUpperCase() + mode.slice(1);
              const icon = mode === 'light' ? 'sunny' : mode === 'dark' ? 'moon' : 'phone-portrait';
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.themeModeBtn,
                    { backgroundColor: themeColors.background },
                    isActive && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
                  ]}
                  onPress={() => updatePrefs({ themeMode: mode })}
                >
                  <Ionicons 
                    name={icon as any} 
                    size={20} 
                    color={isActive ? '#fff' : themeColors.textSecondary} 
                  />
                  <Text style={[
                    styles.themeModeBtnText, 
                    { color: themeColors.textSecondary },
                    isActive && { color: '#fff' }
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Light Mode Theme Picker */}
          {(prefs.themeMode === 'light' || prefs.themeMode === 'system') && (
            <View style={styles.darkThemeSection}>
              <Text style={[styles.subsectionTitle, { color: themeColors.text }]}>
                ☀️ Light Mode Theme
              </Text>
              <Text style={[styles.infoTextSmall, { color: themeColors.textSecondary }]}>
                Colors to use in light mode
              </Text>
              <View style={styles.themeGrid}>
                {(Object.keys(THEME_PRESETS) as ThemePresetKey[])
                  .filter(key => !key.endsWith('Dark') && key !== 'slate' && key !== 'custom') // only light themes
                  .map((key) => {
                    const preset = THEME_PRESETS[key];
                    const isActive = theme === key;
                    return (
                      <TouchableOpacity
                        key={`light-${key}`}
                        style={[
                          styles.themeCard,
                          { backgroundColor: themeColors.background },
                          isActive && { borderColor: preset.primary, borderWidth: 2.5 },
                        ]}
                        onPress={() => setTheme(key)}
                      >
                        <View style={styles.themePreview}>
                          <View style={[styles.themeColorDot, { backgroundColor: preset.primary }]} />
                          <View style={[styles.themeColorDot, { backgroundColor: preset.secondary }]} />
                          <View style={[styles.themeColorDot, { backgroundColor: preset.accent }]} />
                        </View>
                        <Text style={[
                          styles.themeLabel, 
                          { color: themeColors.textSecondary },
                          isActive && { color: preset.primary, fontWeight: '700' }
                        ]}>
                          {preset.label}
                        </Text>
                        {isActive && (
                          <Ionicons name="checkmark-circle" size={18} color={preset.primary} style={styles.themeCheck} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>
          )}

          {/* Dark Mode Theme Picker */}
          {(prefs.themeMode === 'dark' || prefs.themeMode === 'system') && (
            <View style={styles.darkThemeSection}>
              <Text style={[styles.subsectionTitle, { color: themeColors.text }]}>
                🌙 Dark Mode Theme
              </Text>
              <Text style={[styles.infoTextSmall, { color: themeColors.textSecondary }]}>
                Colors to use in dark mode
              </Text>
              <View style={styles.themeGrid}>
                {(Object.keys(THEME_PRESETS) as ThemePresetKey[])
                  .filter(key => key.endsWith('Dark') || key === 'slate') // only dark themes
                  .map((key) => {
                    const preset = THEME_PRESETS[key];
                    const isActive = prefs.darkModeTheme === key;
                    return (
                      <TouchableOpacity
                        key={`dark-${key}`}
                        style={[
                          styles.themeCard,
                          { backgroundColor: themeColors.background },
                          isActive && { borderColor: preset.primary, borderWidth: 2.5 },
                        ]}
                        onPress={() => updatePrefs({ darkModeTheme: key })}
                      >
                        <View style={styles.themePreview}>
                          <View style={[styles.themeColorDot, { backgroundColor: preset.primary }]} />
                          <View style={[styles.themeColorDot, { backgroundColor: preset.secondary }]} />
                          <View style={[styles.themeColorDot, { backgroundColor: preset.accent }]} />
                        </View>
                        <Text style={[
                          styles.themeLabel, 
                          { color: themeColors.textSecondary },
                          isActive && { color: preset.primary, fontWeight: '700' }
                        ]}>
                          {preset.label}
                        </Text>
                        {isActive && (
                          <Ionicons name="checkmark-circle" size={18} color={preset.primary} style={styles.themeCheck} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>
          )}

          {/* Custom Color Picker - shown when custom theme is selected for light mode */}
          {theme === 'custom' && (prefs.themeMode === 'light' || prefs.themeMode === 'system') && (
            <View style={styles.customThemeSection}>
              <Text style={[styles.subsectionTitle, { color: themeColors.primary }]}>
                Customize Your Colors
              </Text>
              
              {/* Primary Color */}
              <View style={styles.colorPickerRow}>
                <Text style={[styles.colorLabel, { color: themeColors.textSecondary }]}>Primary</Text>
                <View style={styles.colorOptionsRow}>
                  {COLOR_OPTIONS.map((color) => (
                    <TouchableOpacity
                      key={`primary-${color}`}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        customPrimary === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => setCustomPrimary(color)}
                    >
                      {customPrimary === color && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Secondary Color */}
              <View style={styles.colorPickerRow}>
                <Text style={[styles.colorLabel, { color: themeColors.textSecondary }]}>Secondary</Text>
                <View style={styles.colorOptionsRow}>
                  {COLOR_OPTIONS.map((color) => (
                    <TouchableOpacity
                      key={`secondary-${color}`}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        customSecondary === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => setCustomSecondary(color)}
                    >
                      {customSecondary === color && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Accent Color */}
              <View style={styles.colorPickerRow}>
                <Text style={[styles.colorLabel, { color: themeColors.textSecondary }]}>Accent</Text>
                <View style={styles.colorOptionsRow}>
                  {COLOR_OPTIONS.map((color) => (
                    <TouchableOpacity
                      key={`accent-${color}`}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        customAccent === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => setCustomAccent(color)}
                    >
                      {customAccent === color && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Preview */}
              <View style={styles.customPreview}>
                <Text style={[styles.colorLabel, { color: themeColors.textSecondary }]}>Preview</Text>
                <View style={styles.previewRow}>
                  <View style={[styles.previewSwatch, { backgroundColor: customPrimary }]}>
                    <Text style={styles.previewLabel}>Primary</Text>
                  </View>
                  <View style={[styles.previewSwatch, { backgroundColor: customSecondary }]}>
                    <Text style={styles.previewLabel}>Secondary</Text>
                  </View>
                  <View style={[styles.previewSwatch, { backgroundColor: customAccent }]}>
                    <Text style={styles.previewLabel}>Accent</Text>
                  </View>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveCustomButton, { backgroundColor: customPrimary }]}
                onPress={handleSaveCustomColors}
              >
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveCustomButtonText}>Apply Custom Theme</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ====== UNITS ====== */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="options-outline" size={20} color={themeColors.accent} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Units</Text>
          </View>

          <View style={[styles.preferenceRow, { borderBottomColor: themeColors.textSecondary + '30' }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>Weight Unit</Text>
              <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>
                {prefs.weightUnit === 'lbs' ? 'Pounds (lbs)' : 'Kilograms (kg)'}
              </Text>
            </View>
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleLabel, { color: themeColors.textSecondary }]}>kg</Text>
              <Switch
                value={prefs.weightUnit === 'lbs'}
                onValueChange={(val) => updatePrefs({ weightUnit: val ? 'lbs' : 'kg' })}
                trackColor={{ false: themeColors.textSecondary, true: themeColors.primary }}
                thumbColor={themeColors.surface}
              />
              <Text style={[styles.toggleLabel, { color: themeColors.textSecondary }]}>lbs</Text>
            </View>
          </View>

          <View style={[styles.preferenceRow, { borderBottomColor: themeColors.textSecondary + '30' }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>Measurement Unit</Text>
              <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>
                {prefs.measurementUnit === 'in' ? 'Inches (in)' : 'Centimeters (cm)'}
              </Text>
            </View>
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleLabel, { color: themeColors.textSecondary }]}>cm</Text>
              <Switch
                value={prefs.measurementUnit === 'in'}
                onValueChange={(val) => updatePrefs({ measurementUnit: val ? 'in' : 'cm' })}
                trackColor={{ false: themeColors.textSecondary, true: themeColors.primary }}
                thumbColor={themeColors.surface}
              />
              <Text style={[styles.toggleLabel, { color: themeColors.textSecondary }]}>in</Text>
            </View>
          </View>
        </View>

        {/* ====== APPLE HEALTH ====== */}
        {Platform.OS === 'ios' && (
          <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={20} color="#FF2D55" />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Apple Health</Text>
            </View>
            
            {!healthKitAvailable ? (
              <View style={[styles.infoBox, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="information-circle" size={20} color={colors.warningDark} />
                <Text style={[styles.infoBoxText, { color: colors.warningDark }]}>
                  Apple Health integration requires a custom development build. 
                  It's not available in Expo Go.
                </Text>
              </View>
            ) : (
              <>
                <View style={[styles.preferenceRow, { borderBottomColor: themeColors.textSecondary + '30' }]}>
                  <View style={styles.preferenceInfo}>
                    <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>Sync with Apple Health</Text>
                    <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>
                      {healthKitEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                  </View>
                  <Switch
                    value={healthKitEnabled}
                    onValueChange={handleHealthKitToggle}
                    trackColor={{ false: themeColors.textSecondary, true: '#FF2D55' }}
                    thumbColor={themeColors.surface}
                    disabled={healthKitSyncing}
                  />
                </View>
                
                {healthKitEnabled && (
                  <>
                    <View style={[styles.preferenceRow, { borderBottomColor: themeColors.textSecondary + '30' }]}>
                      <View style={styles.preferenceInfo}>
                        <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>Last Synced</Text>
                        <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>
                          {lastHealthKitSync 
                            ? lastHealthKitSync.toLocaleDateString() + ' ' + lastHealthKitSync.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                            : 'Never'
                          }
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.syncButton, { backgroundColor: '#FF2D55' }]}
                        onPress={handleHealthKitSync}
                        disabled={healthKitSyncing}
                      >
                        {healthKitSyncing ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="sync" size={16} color="#fff" />
                            <Text style={styles.syncButtonText}>Sync Now</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                      Weight data will be synced between this app and Apple Health.
                    </Text>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* ====== CHARTS ====== */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics-outline" size={20} color={themeColors.secondary} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Charts</Text>
          </View>

          <View style={[styles.preferenceRow, { borderBottomColor: themeColors.textSecondary + '30' }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>Chart Style</Text>
              <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>
                {prefs.chartStyle === 'curved' ? 'Smooth curves' : 'Straight lines'}
              </Text>
            </View>
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleLabel, { color: themeColors.textSecondary }]}>Flat</Text>
              <Switch
                value={prefs.chartStyle === 'curved'}
                onValueChange={(val) => updatePrefs({ chartStyle: val ? 'curved' : 'straight' })}
                trackColor={{ false: themeColors.textSecondary, true: themeColors.primary }}
                thumbColor={themeColors.surface}
              />
              <Text style={[styles.toggleLabel, { color: themeColors.textSecondary }]}>Curve</Text>
            </View>
          </View>

          <View style={[styles.preferenceRow, { borderBottomColor: themeColors.textSecondary + '30' }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>Show Goal Line</Text>
              <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>Display goal weight on charts</Text>
            </View>
            <Switch
              value={prefs.showGoalLine}
              onValueChange={(val) => updatePrefs({ showGoalLine: val })}
              trackColor={{ false: themeColors.textSecondary, true: themeColors.primary }}
              thumbColor={themeColors.surface}
            />
          </View>

          <View style={[styles.preferenceRow, { borderBottomColor: themeColors.textSecondary + '30' }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>Show BMI</Text>
              <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>Display BMI calculations</Text>
            </View>
            <Switch
              value={prefs.showBMI}
              onValueChange={(val) => updatePrefs({ showBMI: val })}
              trackColor={{ false: themeColors.textSecondary, true: themeColors.primary }}
              thumbColor={themeColors.surface}
            />
          </View>

          <Text style={[styles.inputLabel, { marginTop: spacing.md, color: themeColors.textSecondary }]}>Default Chart Range</Text>
          <View style={styles.chartRangeRow}>
            {CHART_RANGE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chartRangeBtn,
                  { backgroundColor: themeColors.background, borderColor: themeColors.textSecondary + '40' },
                  prefs.defaultChartRange === opt.value && { backgroundColor: themeColors.primary },
                ]}
                onPress={() => updatePrefs({ defaultChartRange: opt.value })}
              >
                <Text
                  style={[
                    styles.chartRangeBtnText,
                    { color: themeColors.textSecondary },
                    prefs.defaultChartRange === opt.value && { color: '#fff' },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ====== DISPLAY ====== */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye-outline" size={20} color={themeColors.primary} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Display</Text>
          </View>

          <View style={[styles.preferenceRow, { borderBottomColor: themeColors.textSecondary + '30' }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>Daily Motivation</Text>
              <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>Show motivational tips on home</Text>
            </View>
            <Switch
              value={prefs.showMotivation}
              onValueChange={(val) => updatePrefs({ showMotivation: val })}
              trackColor={{ false: themeColors.textSecondary, true: themeColors.primary }}
              thumbColor={themeColors.surface}
            />
          </View>
        </View>

        {/* ====== SECURITY ====== */}
        <SecuritySection />

        {/* ====== ACCOUNT & CLOUD SYNC ====== */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cloud-outline" size={20} color={themeColors.secondary} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Account & Cloud Sync</Text>
          </View>

          {isAuthenticated ? (
            <>
              <View style={[styles.accountInfo, { backgroundColor: themeColors.background }]}>
                <View style={[styles.accountAvatar, { backgroundColor: themeColors.primaryLight }]}>
                  <Ionicons name="person" size={24} color={themeColors.primary} />
                </View>
                <View style={styles.accountDetails}>
                  <Text style={[styles.accountEmail, { color: themeColors.text }]}>{user?.email}</Text>
                  <Text style={[styles.accountStatus, { color: themeColors.accent }]}>✓ Signed in</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.signOutButton}
                onPress={() => {
                  Alert.alert('Sign Out', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: signOut },
                  ]);
                }}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>

              {/* Passkey Management */}
              <View style={[styles.passkeySection, { borderTopColor: themeColors.textSecondary + '30' }]}>
                <View style={styles.passkeySectionHeader}>
                  <Ionicons name="finger-print" size={18} color={themeColors.primary} />
                  <Text style={[styles.passkeySectionTitle, { color: themeColors.text }]}>Passkeys</Text>
                </View>
                
                {isLoadingPasskeys ? (
                  <ActivityIndicator size="small" color={themeColors.primary} />
                ) : passkeys.length > 0 ? (
                  passkeys.map((pk, idx) => (
                    <View key={pk.credentialId || idx} style={[styles.passkeyItem, { backgroundColor: themeColors.background }]}>
                      <View style={styles.passkeyInfo}>
                        <Ionicons name="key-outline" size={16} color={themeColors.textSecondary} />
                        <Text style={[styles.passkeyName, { color: themeColors.text }]}>
                          {pk.friendlyName || `Passkey ${idx + 1}`}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeletePasskey(pk.credentialId)}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.noPasskeysText, { color: themeColors.textSecondary }]}>No passkeys registered</Text>
                )}
                
                <TouchableOpacity
                  style={[styles.addPasskeyButton, { borderColor: themeColors.primary }]}
                  onPress={handleRegisterPasskey}
                >
                  <Ionicons name="add" size={18} color={themeColors.primary} />
                  <Text style={[styles.addPasskeyText, { color: themeColors.primary }]}>
                    Add Passkey
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                Sign in to back up your data and sync across devices.
              </Text>
              
              <View style={styles.cloudFeatures}>
                <View style={styles.cloudFeature}>
                  <Ionicons name="sync-outline" size={18} color={themeColors.primary} />
                  <Text style={[styles.cloudFeatureText, { color: themeColors.text }]}>Sync across devices</Text>
                </View>
                <View style={styles.cloudFeature}>
                  <Ionicons name="cloud-upload-outline" size={18} color={themeColors.primary} />
                  <Text style={[styles.cloudFeatureText, { color: themeColors.text }]}>Automatic backup</Text>
                </View>
                <View style={styles.cloudFeature}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={themeColors.primary} />
                  <Text style={[styles.cloudFeatureText, { color: themeColors.text }]}>Secure & private</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.signInButton, { backgroundColor: themeColors.primary }]}
                onPress={() => navigation.navigate('Auth')}
              >
                <Ionicons name="person-add-outline" size={20} color="#fff" />
                <Text style={styles.signInButtonText}>Sign In / Create Account</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ====== ABOUT ====== */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="heart-outline" size={20} color={themeColors.primary} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>About</Text>
          </View>

          <View style={styles.aboutRow}>
            <Ionicons name="heart" size={18} color={themeColors.primary} />
            <Text style={[styles.aboutText, { color: themeColors.text }]}>Health Tracker v3.0</Text>
          </View>
          <Text style={[styles.aboutDescription, { color: themeColors.textSecondary }]}>
            Track your weight loss journey with Zepbound. Features include weight tracking,
            body measurements, in-depth charts & analytics, and personalized insights.
          </Text>
        </View>

        {/* ====== DATA MANAGEMENT ====== */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning-outline" size={20} color={colors.error} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Data Management</Text>
          </View>

          <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
            Clear all app data including weight entries, measurements, medications, and nutrition logs. This action cannot be undone.
          </Text>

          <TouchableOpacity
            style={[styles.dangerButton, { borderColor: colors.error }]}
            onPress={() => setShowClearDataModal(true)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.dangerButtonText, { color: colors.error }]}>Clear All Data</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Clear Data Confirmation Modal */}
      <Modal visible={showClearDataModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={48} color={colors.error} />
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Clear All Data?</Text>
            </View>
            
            <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
              This will permanently delete all your data including:
            </Text>
            <View style={styles.deleteList}>
              <Text style={[styles.deleteItem, { color: themeColors.text }]}>• Weight entries</Text>
              <Text style={[styles.deleteItem, { color: themeColors.text }]}>• Body measurements</Text>
              <Text style={[styles.deleteItem, { color: themeColors.text }]}>• Medication logs</Text>
              <Text style={[styles.deleteItem, { color: themeColors.text }]}>• Nutrition data</Text>
              <Text style={[styles.deleteItem, { color: themeColors.text }]}>• Profile information</Text>
            </View>
            
            <Text style={[styles.confirmLabel, { color: themeColors.textSecondary }]}>
              Type "DELETE ALL" to confirm:
            </Text>
            <TextInput
              style={[styles.confirmInput, { 
                backgroundColor: themeColors.background, 
                color: themeColors.text,
                borderColor: clearDataConfirmText === 'DELETE ALL' ? colors.success : themeColors.textSecondary
              }]}
              value={clearDataConfirmText}
              onChangeText={setClearDataConfirmText}
              placeholder="DELETE ALL"
              placeholderTextColor={themeColors.textSecondary}
              autoCapitalize="characters"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: themeColors.textSecondary }]}
                onPress={() => {
                  setShowClearDataModal(false);
                  setClearDataConfirmText('');
                }}
              >
                <Text style={[styles.modalCancelText, { color: themeColors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn, 
                  { backgroundColor: clearDataConfirmText === 'DELETE ALL' ? colors.error : colors.error + '40' }
                ]}
                onPress={handleClearAllData}
                disabled={clearDataConfirmText !== 'DELETE ALL' || isClearing}
              >
                {isClearing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Delete Everything</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// Security Section Component
function SecuritySection() {
  const { themeColors } = useTheme();
  const { isAvailable, isEnabled, biometricType, lockTimeout, setEnabled, setLockTimeout } = useBiometric();
  const [isEnabling, setIsEnabling] = useState(false);

  const getBiometricLabel = () => {
    switch (biometricType) {
      case 'facial': return 'Face ID';
      case 'fingerprint': return 'Touch ID';
      case 'iris': return 'Iris';
      default: return 'Biometrics';
    }
  };

  const getBiometricIcon = (): 'scan-outline' | 'finger-print-outline' | 'eye-outline' | 'lock-closed-outline' => {
    switch (biometricType) {
      case 'facial': return 'scan-outline';
      case 'fingerprint': return 'finger-print-outline';
      case 'iris': return 'eye-outline';
      default: return 'lock-closed-outline';
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    setIsEnabling(true);
    try {
      await setEnabled(value);
    } catch (error) {
      Alert.alert('Error', 'Failed to change biometric lock setting. Please try again.');
    } finally {
      setIsEnabling(false);
    }
  };

  const TIMEOUT_OPTIONS = [
    { value: 0, label: 'Immediately' },
    { value: 1, label: '1 minute' },
    { value: 5, label: '5 minutes' },
    { value: 15, label: '15 minutes' },
  ];

  if (!isAvailable) {
    return (
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-outline" size={20} color={themeColors.primary} />
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Security</Text>
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Text style={[styles.preferenceLabel, { color: themeColors.textSecondary }]}>Biometric Lock</Text>
            <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>
              Not available on this device
            </Text>
          </View>
          <Ionicons name="close-circle-outline" size={24} color={themeColors.textSecondary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
      <View style={styles.sectionHeader}>
        <Ionicons name="shield-outline" size={20} color={themeColors.primary} />
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Security</Text>
      </View>

      <View style={[styles.preferenceRow, { borderBottomColor: themeColors.textSecondary + '30' }]}>
        <View style={styles.preferenceInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={getBiometricIcon()} size={18} color={themeColors.primary} />
            <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>{getBiometricLabel()} Lock</Text>
          </View>
          <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>
            Require {getBiometricLabel()} to open app
          </Text>
        </View>
        {isEnabling ? (
          <ActivityIndicator size="small" color={themeColors.primary} />
        ) : (
          <Switch
            value={isEnabled}
            onValueChange={handleToggleBiometric}
            trackColor={{ false: themeColors.textSecondary, true: themeColors.primary }}
            thumbColor={themeColors.surface}
          />
        )}
      </View>

      {isEnabled && (
        <View style={[styles.preferenceRow, { borderBottomWidth: 0 }]}>
          <View style={styles.preferenceInfo}>
            <Text style={[styles.preferenceLabel, { color: themeColors.text }]}>Lock After</Text>
            <Text style={[styles.preferenceValue, { color: themeColors.textSecondary }]}>
              Time in background before requiring unlock
            </Text>
          </View>
        </View>
      )}

      {isEnabled && (
        <View style={styles.chartRangeRow}>
          {TIMEOUT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chartRangeBtn,
                { backgroundColor: themeColors.background, borderColor: themeColors.textSecondary + '40' },
                lockTimeout === opt.value && { backgroundColor: themeColors.primary },
              ]}
              onPress={() => setLockTimeout(opt.value)}
            >
              <Text
                style={[
                  styles.chartRangeBtnText,
                  { color: themeColors.textSecondary },
                  lockTimeout === opt.value && { color: '#fff' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.background,
    color: colors.text,
  },
  heightInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heightInput: {
    width: 65,
    textAlign: 'center',
  },
  heightLabel: {
    marginHorizontal: spacing.sm,
    color: colors.textSecondary,
    fontSize: 16,
  },
  goalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalInput: {
    flex: 1,
    marginRight: spacing.sm,
  },
  goalLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  // Theme grid
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themeCard: {
    width: '30%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: 90,
    flexGrow: 1,
  },
  themePreview: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: spacing.xs,
  },
  themeColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  themeCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  // Preferences
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 16,
    color: colors.text,
  },
  preferenceValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginHorizontal: spacing.xs,
  },
  // Chart range
  chartRangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chartRangeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartRangeBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  // About
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  aboutText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  aboutDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  // Account section
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  accountDetails: {
    flex: 1,
  },
  accountEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  accountStatus: {
    fontSize: 13,
    color: colors.success,
    marginTop: 2,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  lastSyncText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  signOutText: {
    fontSize: 14,
    color: colors.error,
    marginLeft: spacing.xs,
  },
  passkeySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  passkeySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  passkeySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  passkeyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  passkeyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passkeyName: {
    fontSize: 14,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  noPasskeysText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  addPasskeyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  addPasskeyText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: spacing.xs,
  },
  cloudFeatures: {
    marginBottom: spacing.md,
  },
  cloudFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cloudFeatureText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  comingSoonBadge: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  localStorageNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  localStorageText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  setupSteps: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  setupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  setupStep: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
    paddingLeft: spacing.sm,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  awsNoteText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  customThemeSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  colorPickerRow: {
    marginBottom: spacing.md,
  },
  colorLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  colorOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  customPreview: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewSwatch: {
    flex: 1,
    height: 50,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  saveCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  saveCustomButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  // Dark mode styles
  themeModeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  themeModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  themeModeBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  darkThemeSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoTextSmall: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  // Danger/Clear data styles
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal styles  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.lg,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  deleteList: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  deleteItem: {
    fontSize: 14,
    lineHeight: 22,
  },
  confirmLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  confirmInput: {
    borderWidth: 2,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
