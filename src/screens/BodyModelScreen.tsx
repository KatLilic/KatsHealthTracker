import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Ellipse, G, Line, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO } from 'date-fns';
import {
  getMeasurements,
  getWeightEntries,
  getUserProfile,
  MeasurementEntry,
} from '../database/db';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');

// AsyncStorage key for skin tone
export const SKIN_TONE_KEY = '@body_skin_tone';
const DEFAULT_SKIN = '#F5D5C8';

// Reference measurements (average female, inches)
const REF = {
  ribCage: 34, waist: 30, lowerBelly: 34, hips: 38,
  leftArm: 11, rightArm: 11, leftWrist: 6.5, rightWrist: 6.5,
  leftThigh: 22, rightThigh: 22, leftCalf: 14.5, rightCalf: 14.5,
};

interface BodyData {
  weight: number | null;
  height: number | null;
  ribCage: number | null;
  waist: number | null;
  lowerBelly: number | null;
  hips: number | null;
  leftArm: number | null;
  rightArm: number | null;
  leftWrist: number | null;
  rightWrist: number | null;
  leftThigh: number | null;
  rightThigh: number | null;
  leftCalf: number | null;
  rightCalf: number | null;
}

const MEASUREMENT_POINTS: { [key: string]: { label: string; icon: string } } = {
  ribCage: { label: 'Rib Cage', icon: 'body-outline' },
  waist: { label: 'Waist', icon: 'resize-outline' },
  lowerBelly: { label: 'Lower Belly', icon: 'ellipse-outline' },
  hips: { label: 'Hips / Glutes', icon: 'ellipse-outline' },
  leftArm: { label: 'Left Arm', icon: 'fitness-outline' },
  rightArm: { label: 'Right Arm', icon: 'fitness-outline' },
  leftWrist: { label: 'Left Wrist', icon: 'hand-left-outline' },
  rightWrist: { label: 'Right Wrist', icon: 'hand-right-outline' },
  leftThigh: { label: 'Left Thigh', icon: 'walk-outline' },
  rightThigh: { label: 'Right Thigh', icon: 'walk-outline' },
  leftCalf: { label: 'Left Calf', icon: 'footsteps-outline' },
  rightCalf: { label: 'Right Calf', icon: 'footsteps-outline' },
};

// --- SVG Body Path Generators ---

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function sf(val: number | null, ref: number) {
  if (!val || val <= 0) return 1;
  return clamp(val / ref, 0.82, 1.22);
}

function buildTorsoPath(ribHW: number, waistHW: number, bellyHW: number, hipHW: number) {
  const cx = 100;
  const shW = Math.max(ribHW + 5, 38);
  return [
    `M ${cx - 12},55`,
    `L ${cx - shW},66`,
    `C ${cx - shW},82 ${cx - ribHW - 2},95 ${cx - ribHW},105`,
    `C ${cx - ribHW + 1},118 ${cx - waistHW - 3},130 ${cx - waistHW},140`,
    `C ${cx - waistHW + 1},148 ${cx - bellyHW - 2},152 ${cx - bellyHW},158`,
    `C ${cx - bellyHW - 1},165 ${cx - hipHW + 1},172 ${cx - hipHW},180`,
    `C ${cx - hipHW - 1},195 ${cx - 14},206 ${cx - 6},212`,
    `L ${cx + 6},212`,
    `C ${cx + 14},206 ${cx + hipHW + 1},195 ${cx + hipHW},180`,
    `C ${cx + hipHW - 1},172 ${cx + bellyHW + 1},165 ${cx + bellyHW},158`,
    `C ${cx + bellyHW + 2},152 ${cx + waistHW - 1},148 ${cx + waistHW},140`,
    `C ${cx + waistHW + 3},130 ${cx + ribHW - 1},118 ${cx + ribHW},105`,
    `C ${cx + ribHW + 2},95 ${cx + shW},82 ${cx + shW},66`,
    `L ${cx + 12},55`,
    `Z`,
  ].join(' ');
}

function buildArmPath(armCX: number, armHW: number, wristHW: number) {
  const mid = (armHW + wristHW) / 2;
  return [
    `M ${armCX - armHW},68`,
    `C ${armCX - armHW},100 ${armCX - armHW + 1},130 ${armCX - mid},145`,
    `C ${armCX - wristHW - 1},165 ${armCX - wristHW},180 ${armCX - wristHW},192`,
    `L ${armCX - wristHW - 2},200`,
    `L ${armCX + wristHW + 2},200`,
    `L ${armCX + wristHW},192`,
    `C ${armCX + wristHW},180 ${armCX + wristHW + 1},165 ${armCX + mid},145`,
    `C ${armCX + armHW - 1},130 ${armCX + armHW},100 ${armCX + armHW},68`,
    `Z`,
  ].join(' ');
}

function buildLegPath(legCX: number, thighHW: number, calfHW: number) {
  const kneeHW = Math.min(thighHW * 0.7, 12);
  const ankleHW = 6;
  return [
    `M ${legCX - thighHW},210`,
    `C ${legCX - thighHW - 1},235 ${legCX - kneeHW - 2},265 ${legCX - kneeHW},282`,
    `C ${legCX - kneeHW + 1},295 ${legCX - calfHW - 1},310 ${legCX - calfHW},330`,
    `C ${legCX - calfHW + 1},350 ${legCX - ankleHW - 1},365 ${legCX - ankleHW},378`,
    `L ${legCX - ankleHW - 4},395`,
    `L ${legCX + ankleHW + 4},395`,
    `L ${legCX + ankleHW},378`,
    `C ${legCX + ankleHW + 1},365 ${legCX + calfHW - 1},350 ${legCX + calfHW},330`,
    `C ${legCX + calfHW + 1},310 ${legCX + kneeHW - 1},295 ${legCX + kneeHW},282`,
    `C ${legCX + kneeHW + 2},265 ${legCX + thighHW + 1},235 ${legCX + thighHW},210`,
    `Z`,
  ].join(' ');
}

// Measurement indicator positions on the body
const INDICATOR_POSITIONS: { [key: string]: { x: number; y: number; type: 'line' | 'dot' } } = {
  ribCage:    { x: 100, y: 105, type: 'line' },
  waist:      { x: 100, y: 140, type: 'line' },
  lowerBelly: { x: 100, y: 158, type: 'line' },
  hips:       { x: 100, y: 180, type: 'line' },
  leftArm:    { x: 56,  y: 115, type: 'dot' },
  rightArm:   { x: 144, y: 115, type: 'dot' },
  leftWrist:  { x: 56,  y: 185, type: 'dot' },
  rightWrist: { x: 144, y: 185, type: 'dot' },
  leftThigh:  { x: 82,  y: 250, type: 'dot' },
  rightThigh: { x: 118, y: 250, type: 'dot' },
  leftCalf:   { x: 82,  y: 330, type: 'dot' },
  rightCalf:  { x: 118, y: 330, type: 'dot' },
};

// --- Component ---

export default function BodyModelScreen() {
  const [bodyData, setBodyData] = useState<BodyData | null>(null);
  const [latestMeasurement, setLatestMeasurement] = useState<MeasurementEntry | null>(null);
  const [previousMeasurement, setPreviousMeasurement] = useState<MeasurementEntry | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState<string | null>(null);
  const [skinColor, setSkinColor] = useState(DEFAULT_SKIN);

  // Load skin tone preference
  useEffect(() => {
    AsyncStorage.getItem(SKIN_TONE_KEY).then((val) => {
      if (val) setSkinColor(val);
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [measurements, weights, profile] = await Promise.all([
        getMeasurements(10),
        getWeightEntries(1),
        getUserProfile(),
      ]);

      const latest = measurements[0] || null;
      const previous = measurements[1] || null;
      setLatestMeasurement(latest);
      setPreviousMeasurement(previous);

      const cmToInches = (cm: number | null) => (cm ? cm / 2.54 : null);

      setBodyData({
        weight: weights[0]?.weight_kg ? weights[0].weight_kg * 2.205 : null,
        height: profile?.height_cm ? profile.height_cm / 2.54 : null,
        ribCage: cmToInches(latest?.rib_cage_cm ?? null),
        waist: cmToInches(latest?.waist_cm ?? null),
        lowerBelly: cmToInches(latest?.lower_belly_cm ?? null),
        hips: cmToInches(latest?.hips_cm ?? null),
        leftArm: cmToInches(latest?.left_arm_cm ?? null),
        rightArm: cmToInches(latest?.right_arm_cm ?? null),
        leftWrist: cmToInches(latest?.left_wrist_cm ?? null),
        rightWrist: cmToInches(latest?.right_wrist_cm ?? null),
        leftThigh: cmToInches(latest?.left_thigh_cm ?? null),
        rightThigh: cmToInches(latest?.right_thigh_cm ?? null),
        leftCalf: cmToInches(latest?.left_calf_cm ?? null),
        rightCalf: cmToInches(latest?.right_calf_cm ?? null),
      });
      // Reload skin tone in case settings changed
      const tone = await AsyncStorage.getItem(SKIN_TONE_KEY);
      if (tone) setSkinColor(tone);
    } catch (error) {
      console.error('Failed to load body data:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Compute scaled half-widths
  const ribHW = Math.round(33 * sf(bodyData?.ribCage ?? null, REF.ribCage));
  const waistHW = Math.round(24 * sf(bodyData?.waist ?? null, REF.waist));
  const bellyHW = Math.round(27 * sf(bodyData?.lowerBelly ?? null, REF.lowerBelly));
  const hipHW = Math.round(39 * sf(bodyData?.hips ?? null, REF.hips));
  const lArmHW = Math.round(9 * sf(bodyData?.leftArm ?? null, REF.leftArm));
  const rArmHW = Math.round(9 * sf(bodyData?.rightArm ?? null, REF.rightArm));
  const lWristHW = Math.round(5 * sf(bodyData?.leftWrist ?? null, REF.leftWrist));
  const rWristHW = Math.round(5 * sf(bodyData?.rightWrist ?? null, REF.rightWrist));
  const lThighHW = Math.round(19 * sf(bodyData?.leftThigh ?? null, REF.leftThigh));
  const rThighHW = Math.round(19 * sf(bodyData?.rightThigh ?? null, REF.rightThigh));
  const lCalfHW = Math.round(13 * sf(bodyData?.leftCalf ?? null, REF.leftCalf));
  const rCalfHW = Math.round(13 * sf(bodyData?.rightCalf ?? null, REF.rightCalf));

  // SVG Paths
  const torsoPath = buildTorsoPath(ribHW, waistHW, bellyHW, hipHW);
  const leftArmPath = buildArmPath(56, lArmHW, lWristHW);
  const rightArmPath = buildArmPath(144, rArmHW, rWristHW);
  const leftLegPath = buildLegPath(82, lThighHW, lCalfHW);
  const rightLegPath = buildLegPath(118, rThighHW, rCalfHW);

  // Darker shade for body outline
  const outlineColor = skinColor + '80';

  const getChange = (key: string): number | null => {
    if (!latestMeasurement || !previousMeasurement) return null;
    const keyMap: { [k: string]: keyof MeasurementEntry } = {
      ribCage: 'rib_cage_cm', waist: 'waist_cm', lowerBelly: 'lower_belly_cm',
      hips: 'hips_cm', leftArm: 'left_arm_cm', rightArm: 'right_arm_cm',
      leftWrist: 'left_wrist_cm', rightWrist: 'right_wrist_cm',
      leftThigh: 'left_thigh_cm', rightThigh: 'right_thigh_cm',
      leftCalf: 'left_calf_cm', rightCalf: 'right_calf_cm',
    };
    const dbKey = keyMap[key];
    if (!dbKey) return null;
    const current = latestMeasurement[dbKey] as number | null;
    const prev = previousMeasurement[dbKey] as number | null;
    if (current === null || prev === null) return null;
    return (current - prev) / 2.54;
  };

  const formatValue = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '\u2014';
    return value.toFixed(1);
  };

  const measurementKeys = Object.keys(MEASUREMENT_POINTS);
  const hasMeasurements = latestMeasurement !== null;

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.headerStats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Weight</Text>
          <Text style={styles.statValue}>
            {bodyData?.weight ? `${bodyData.weight.toFixed(1)} lbs` : '\u2014'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Height</Text>
          <Text style={styles.statValue}>
            {bodyData?.height
              ? `${Math.floor(bodyData.height / 12)}'${Math.round(bodyData.height % 12)}"`
              : '\u2014'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Updated</Text>
          <Text style={styles.statValue}>
            {latestMeasurement?.date
              ? format(parseISO(latestMeasurement.date), 'MMM d')
              : '\u2014'}
          </Text>
        </View>
      </View>

      {/* Body Visualization */}
      <View style={styles.modelContainer}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 200 420"
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <LinearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={skinColor} stopOpacity="1" />
              <Stop offset="1" stopColor={skinColor} stopOpacity="0.85" />
            </LinearGradient>
            <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFF9F9" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFE0E6" stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Background */}
          <Path d="M 0,0 L 200,0 L 200,420 L 0,420 Z" fill="url(#bgGrad)" />

          {/* Arms (behind torso) */}
          <Path d={leftArmPath} fill="url(#skinGrad)" stroke={outlineColor} strokeWidth="0.5" />
          <Path d={rightArmPath} fill="url(#skinGrad)" stroke={outlineColor} strokeWidth="0.5" />

          {/* Legs (behind torso) */}
          <Path d={leftLegPath} fill="url(#skinGrad)" stroke={outlineColor} strokeWidth="0.5" />
          <Path d={rightLegPath} fill="url(#skinGrad)" stroke={outlineColor} strokeWidth="0.5" />

          {/* Torso */}
          <Path d={torsoPath} fill="url(#skinGrad)" stroke={outlineColor} strokeWidth="0.5" />

          {/* Neck */}
          <Ellipse cx={100} cy={52} rx={9} ry={10} fill={skinColor} />

          {/* Head */}
          <Ellipse cx={100} cy={30} rx={17} ry={22} fill={skinColor} stroke={outlineColor} strokeWidth="0.5" />

          {/* Hair (decorative) */}
          <Ellipse cx={100} cy={18} rx={19} ry={14} fill="#5C4033" opacity={0.7} />

          {/* Measurement Indicators */}
          {hasMeasurements && Object.entries(INDICATOR_POSITIONS).map(([key, pos]) => {
            const isSelected = selectedMeasurement === key;
            const value = bodyData?.[key as keyof BodyData] as number | null;
            if (!value) return null;

            if (pos.type === 'line') {
              // Horizontal measurement line across torso
              let hw = 20;
              if (key === 'ribCage') hw = ribHW;
              else if (key === 'waist') hw = waistHW;
              else if (key === 'lowerBelly') hw = bellyHW;
              else if (key === 'hips') hw = hipHW;

              return (
                <G key={key}>
                  <Line
                    x1={100 - hw} y1={pos.y} x2={100 + hw} y2={pos.y}
                    stroke={isSelected ? colors.primary : colors.primary + '60'}
                    strokeWidth={isSelected ? 1.5 : 0.8}
                    strokeDasharray={isSelected ? '' : '3,3'}
                  />
                  <Circle cx={100 - hw} cy={pos.y} r={isSelected ? 3 : 2}
                    fill={isSelected ? colors.primary : colors.primary + '80'} />
                  <Circle cx={100 + hw} cy={pos.y} r={isSelected ? 3 : 2}
                    fill={isSelected ? colors.primary : colors.primary + '80'} />
                </G>
              );
            }

            // Dot indicator for limbs
            return (
              <G key={key}>
                <Circle cx={pos.x} cy={pos.y} r={isSelected ? 4 : 2.5}
                  fill={isSelected ? colors.primary : colors.primary + '80'}
                  stroke={isSelected ? '#fff' : 'none'} strokeWidth={1} />
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Measurements Grid */}
      <ScrollView style={styles.measurementsScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Body Measurements</Text>

        {hasMeasurements ? (
          <View style={styles.measurementsGrid}>
            {measurementKeys.map((key) => {
              const point = MEASUREMENT_POINTS[key];
              const value = bodyData?.[key as keyof BodyData] as number | null;
              const change = getChange(key);
              const isSelected = selectedMeasurement === key;

              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.measurementCard, isSelected && styles.measurementCardSelected]}
                  onPress={() => setSelectedMeasurement(isSelected ? null : key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={point.icon as any}
                    size={18}
                    color={isSelected ? colors.primary : colors.textSecondary}
                    style={styles.measurementIcon}
                  />
                  <Text
                    style={[styles.measurementLabel, isSelected && styles.measurementLabelSelected]}
                  >
                    {point.label}
                  </Text>
                  <Text style={styles.measurementValue}>
                    {formatValue(value)}
                    {value !== null && <Text style={styles.measurementUnit}>"</Text>}
                  </Text>
                  {change !== null && (
                    <Text
                      style={[
                        styles.measurementChange,
                        change < 0 ? styles.changePositive : styles.changeNeutral,
                      ]}
                    >
                      {change < 0 ? '\u2193' : change > 0 ? '\u2191' : '\u2192'}{' '}
                      {Math.abs(change).toFixed(1)}"
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="body-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>No measurements yet</Text>
            <Text style={styles.emptySubtext}>
              Add your first body measurements in the Measure tab to see them here
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },
  modelContainer: {
    height: 360,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.md,
  },
  measurementsScroll: {
    flex: 1,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  measurementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  measurementCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  measurementCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '30',
  },
  measurementIcon: { marginBottom: spacing.xs },
  measurementLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  measurementLabelSelected: { color: colors.primaryDark },
  measurementValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  measurementUnit: { fontSize: 14, fontWeight: '400', color: colors.textSecondary },
  measurementChange: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  changePositive: { color: colors.success },
  changeNeutral: { color: colors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 18, color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
