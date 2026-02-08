import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  getWeightEntries,
  getMeasurements,
  getZepboundStats,
  getUserProfile,
} from '../database/db';
import { useTheme } from '../theme/ThemeContext';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

const screenWidth = Dimensions.get('window').width;

interface DashboardStats {
  currentWeight: number | null;
  goalWeight: number | null;
  startingWeight: number | null;
  weightChange7Days: number;
  weightChange30Days: number;
  totalWeightLost: number;
  daysOnProgram: number;
  nextShotDue: string | null;
  totalShots: number;
  latestDose: number | null;
  daysSinceShot: number;
  height: number | null;
  bmi: number | null;
  avgWeeklyLoss: number;
  weightToGoal: number;
  weeksToGoal: number | null;
  loggingStreak: number;
  totalEntries: number;
  userName: string | null;
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { themeColors, prefs } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    currentWeight: null,
    goalWeight: null,
    startingWeight: null,
    weightChange7Days: 0,
    weightChange30Days: 0,
    totalWeightLost: 0,
    daysOnProgram: 0,
    nextShotDue: null,
    totalShots: 0,
    latestDose: null,
    daysSinceShot: 0,
    height: null,
    bmi: null,
    avgWeeklyLoss: 0,
    weightToGoal: 0,
    weeksToGoal: null,
    loggingStreak: 0,
    totalEntries: 0,
    userName: null,
  });
  const [motivationTip, setMotivationTip] = useState('');

  // Animation values for staggered entrance
  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsRowAnim = useRef(new Animated.Value(0)).current;
  const medCardAnim = useRef(new Animated.Value(0)).current;
  const insightsAnim = useRef(new Animated.Value(0)).current;
  const quickActionsAnim = useRef(new Animated.Value(0)).current;

  const runEntranceAnimations = () => {
    // Reset all values
    headerAnim.setValue(0);
    statsRowAnim.setValue(0);
    medCardAnim.setValue(0);
    insightsAnim.setValue(0);
    quickActionsAnim.setValue(0);

    // Staggered animations
    Animated.stagger(100, [
      Animated.spring(headerAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(statsRowAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(medCardAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(insightsAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(quickActionsAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadData = async () => {
    try {
      const profile = await getUserProfile();
      const weights = await getWeightEntries();
      const zepStats = await getZepboundStats();
      const measurements = await getMeasurements();

      const currentWeight = weights[0]?.weight_kg || null;
      const startingWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg : null;
      const goalWeight = profile?.goal_weight_kg || null;
      const height = profile?.height_cm || null;
      
      let weightChange7Days = 0;
      let weightChange30Days = 0;
      let totalWeightLost = 0;

      if (weights.length > 0) {
        const now = new Date();
        
        const weight7DaysAgo = weights.find(w => 
          differenceInDays(now, parseISO(w.date)) >= 7
        );
        if (weight7DaysAgo && currentWeight) {
          weightChange7Days = weight7DaysAgo.weight_kg - currentWeight;
        }

        const weight30DaysAgo = weights.find(w => 
          differenceInDays(now, parseISO(w.date)) >= 30
        );
        if (weight30DaysAgo && currentWeight) {
          weightChange30Days = weight30DaysAgo.weight_kg - currentWeight;
        }

        const firstWeight = weights[weights.length - 1];
        if (firstWeight && currentWeight) {
          totalWeightLost = firstWeight.weight_kg - currentWeight;
        }
      }

      // Calculate BMI (weight in kg / height in meters squared)
      let bmi: number | null = null;
      if (currentWeight && height) {
        const heightInMeters = height / 100;
        bmi = Math.round((currentWeight / (heightInMeters * heightInMeters)) * 10) / 10;
      }

      // Calculate weight to goal
      const weightToGoal = currentWeight && goalWeight ? currentWeight - goalWeight : 0;

      // Calculate average weekly loss and weeks to goal
      let avgWeeklyLoss = 0;
      let weeksToGoal: number | null = null;
      
      let daysOnProgram = 0;
      let daysSinceShot = 100;
      if (zepStats.firstShotDate) {
        daysOnProgram = differenceInDays(new Date(), parseISO(zepStats.firstShotDate));
      } else if (weights.length > 0) {
        const firstWeight = weights[weights.length - 1];
        daysOnProgram = differenceInDays(new Date(), parseISO(firstWeight.date));
      }

      if (daysOnProgram > 7 && totalWeightLost > 0) {
        const weeksOnProgram = daysOnProgram / 7;
        avgWeeklyLoss = Math.round((totalWeightLost / weeksOnProgram) * 100) / 100;
        
        if (avgWeeklyLoss > 0 && weightToGoal > 0) {
          weeksToGoal = Math.ceil(weightToGoal / avgWeeklyLoss);
        }
      }

      // Calculate logging streak (consecutive days with entries)
      let loggingStreak = 0;
      if (weights.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Sort by date descending
        const sortedWeights = [...weights].sort((a, b) => 
          parseISO(b.date).getTime() - parseISO(a.date).getTime()
        );
        
        let checkDate = today;
        for (const entry of sortedWeights) {
          const entryDate = parseISO(entry.date);
          entryDate.setHours(0, 0, 0, 0);
          
          const daysDiff = differenceInDays(checkDate, entryDate);
          
          if (daysDiff <= 1) {
            loggingStreak++;
            checkDate = entryDate;
          } else {
            break;
          }
        }
      }

      let nextShotDue: string | null = null;
      if (zepStats.latestShotDate) {
        const lastShot = parseISO(zepStats.latestShotDate);
        daysSinceShot = differenceInDays(new Date(), lastShot);
        const nextShot = new Date(lastShot);
        nextShot.setDate(nextShot.getDate() + 7);
        nextShotDue = format(nextShot, 'MMM d');
      }

      const newStats: DashboardStats = {
        currentWeight,
        goalWeight,
        startingWeight,
        weightChange7Days,
        weightChange30Days,
        totalWeightLost,
        daysOnProgram,
        nextShotDue,
        totalShots: zepStats.totalShots,
        latestDose: zepStats.currentDose,
        daysSinceShot,
        height,
        bmi,
        avgWeeklyLoss,
        weightToGoal,
        weeksToGoal,
        loggingStreak,
        totalEntries: weights.length,
        userName: profile?.name || null,
      };

      setStats(newStats);

      // Generate local motivation tip
      const tips = [
        'Stay hydrated! Aim for 64+ oz of water daily.',
        'Prioritize protein — aim for 80-100g daily.',
        'Sleep 7-9 hours for optimal weight loss.',
        'A 20-minute walk can make a big difference!',
        'Track beyond the scale — take measurements too!',
        'Celebrate non-scale victories: energy, mood, sleep.',
        'Patience is key — trust the process!',
        'Small consistent steps lead to big results.',
      ];
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      setMotivationTip(tips[dayOfYear % tips.length]);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      runEntranceAnimations();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatWeight = (kg: number | null) => {
    if (kg === null) return '--';
    if (prefs.weightUnit === 'lbs') return (kg * 2.205).toFixed(1);
    return kg.toFixed(1);
  };

  const weightUnit = prefs.weightUnit === 'lbs' ? 'lbs' : 'kg';

  const getProgressPercent = () => {
    if (!stats.currentWeight || !stats.goalWeight || stats.totalWeightLost <= 0) return 0;
    const startWeight = stats.currentWeight + stats.totalWeightLost;
    const toGo = startWeight - stats.goalWeight;
    if (toGo <= 0) return 100;
    return Math.min(100, (stats.totalWeightLost / toGo) * 100);
  };

  const progress = getProgressPercent();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          tintColor={themeColors.primary}
          colors={[themeColors.primary]}
        />
      }
    >
      {/* Personalized Greeting */}
      <Animated.View style={[styles.greetingSection, {
        opacity: headerAnim,
        transform: [
          { translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
        ],
      }]}>
        <Text style={[styles.greetingText, { color: themeColors.text }]}>
          {(() => {
            const hour = new Date().getHours();
            const name = stats.userName || '';
            const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
            return name ? `${greeting}, ${name}! 👋` : `${greeting}! 👋`;
          })()}
        </Text>
        <Text style={[styles.greetingSubtext, { color: themeColors.textSecondary }]}>
          {stats.loggingStreak > 0 
            ? `🔥 ${stats.loggingStreak} day streak! Keep it up!`
            : "Let's track your progress today"}
        </Text>
      </Animated.View>

      {/* Hero Card with Weight */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [
          { translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
          { scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
        ],
      }}>
        <View style={[styles.heroCard, { backgroundColor: themeColors.primary }]}>
          <View style={styles.heroGradient}>
            <Text style={styles.heroLabel}>Current Weight</Text>
            <View style={styles.heroWeightRow}>
              <Text style={styles.heroWeight}>{formatWeight(stats.currentWeight)}</Text>
              <Text style={styles.heroUnit}>{weightUnit}</Text>
            </View>
            
            {stats.goalWeight && (
              <View style={styles.goalSection}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <View style={styles.goalLabels}>
                  <Text style={styles.goalText}>Goal: {formatWeight(stats.goalWeight)} {weightUnit}</Text>
                  <Text style={styles.progressText}>{progress.toFixed(0)}%</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Stats Cards Row */}
      <Animated.View style={[styles.statsRow, {
        opacity: statsRowAnim,
        transform: [
          { translateY: statsRowAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
        ],
      }]}>
        <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderTopColor: themeColors.primary }]}>
          <Text style={[styles.statValue, { color: themeColors.text }]}>
            {stats.weightChange7Days > 0 ? '-' : ''}
            {prefs.weightUnit === 'lbs'
              ? Math.abs(stats.weightChange7Days * 2.205).toFixed(1)
              : Math.abs(stats.weightChange7Days).toFixed(1)}
            <Text style={styles.statUnit}> {weightUnit}</Text>
          </Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Last 7 Days</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderTopColor: colors.success }]}>
          <Text style={[styles.statValue, { color: themeColors.text }]}>
            {stats.totalWeightLost > 0 ? '-' : ''}
            {prefs.weightUnit === 'lbs'
              ? Math.abs(stats.totalWeightLost * 2.205).toFixed(1)
              : Math.abs(stats.totalWeightLost).toFixed(1)}
            <Text style={styles.statUnit}> {weightUnit}</Text>
          </Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Total Lost</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderTopColor: themeColors.secondary }]}>
          <Text style={[styles.statValue, { color: themeColors.text }]}>{stats.daysOnProgram}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Days Active</Text>
        </View>
      </Animated.View>

      {/* Detailed Stats Grid */}
      <Animated.View style={[styles.detailedStatsSection, {
        opacity: statsRowAnim,
        transform: [
          { translateY: statsRowAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
        ],
      }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="analytics" size={20} color={themeColors.primary} />
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Your Journey</Text>
        </View>
        <View style={styles.detailedStatsGrid}>
          {/* BMI */}
          <View style={[styles.detailedStatCard, { borderLeftColor: themeColors.primary, backgroundColor: themeColors.surface }]}>
            <View style={styles.detailedStatHeader}>
              <Ionicons name="body" size={16} color={themeColors.primary} />
              <Text style={[styles.detailedStatLabel, { color: themeColors.textSecondary }]}>BMI</Text>
            </View>
            <Text style={[styles.detailedStatValue, { color: themeColors.primary }]}>
              {stats.bmi ? stats.bmi.toFixed(1) : '--'}
            </Text>
            {stats.bmi && (
              <Text style={[styles.detailedStatSubtext, { color: themeColors.textSecondary }]}>
                {stats.bmi < 18.5 ? 'Underweight' : stats.bmi < 25 ? 'Healthy' : stats.bmi < 30 ? 'Overweight' : 'Obese'}
              </Text>
            )}
          </View>

          {/* Logging Streak */}
          <View style={[styles.detailedStatCard, { borderLeftColor: themeColors.secondary, backgroundColor: themeColors.surface }]}>
            <View style={styles.detailedStatHeader}>
              <Ionicons name="flame" size={16} color={themeColors.secondary} />
              <Text style={[styles.detailedStatLabel, { color: themeColors.textSecondary }]}>Streak</Text>
            </View>
            <Text style={[styles.detailedStatValue, { color: themeColors.secondary }]}>
              {stats.loggingStreak}
            </Text>
            <Text style={[styles.detailedStatSubtext, { color: themeColors.textSecondary }]}>
              {stats.loggingStreak === 1 ? 'day' : 'days'} logging
            </Text>
          </View>

          {/* Starting Weight */}
          <View style={[styles.detailedStatCard, { borderLeftColor: themeColors.accent, backgroundColor: themeColors.surface }]}>
            <View style={styles.detailedStatHeader}>
              <Ionicons name="flag" size={16} color={themeColors.accent} />
              <Text style={[styles.detailedStatLabel, { color: themeColors.textSecondary }]}>Started At</Text>
            </View>
            <Text style={[styles.detailedStatValue, { color: themeColors.accent }]}>
              {formatWeight(stats.startingWeight)}
            </Text>
            <Text style={[styles.detailedStatSubtext, { color: themeColors.textSecondary }]}>{weightUnit}</Text>
          </View>

          {/* Avg Weekly Loss */}
          <View style={[styles.detailedStatCard, { borderLeftColor: themeColors.primaryDark, backgroundColor: themeColors.surface }]}>
            <View style={styles.detailedStatHeader}>
              <Ionicons name="trending-down" size={16} color={themeColors.primaryDark} />
              <Text style={[styles.detailedStatLabel, { color: themeColors.textSecondary }]}>Avg/Week</Text>
            </View>
            <Text style={[styles.detailedStatValue, { color: themeColors.primaryDark }]}>
              {stats.avgWeeklyLoss > 0 ? '-' : ''}
              {prefs.weightUnit === 'lbs'
                ? (stats.avgWeeklyLoss * 2.205).toFixed(1)
                : stats.avgWeeklyLoss.toFixed(1)}
            </Text>
            <Text style={[styles.detailedStatSubtext, { color: themeColors.textSecondary }]}>{weightUnit}/week</Text>
          </View>

          {/* Weight To Goal */}
          {stats.goalWeight && (
            <View style={[styles.detailedStatCard, { borderLeftColor: themeColors.secondary, backgroundColor: themeColors.surface }]}>
              <View style={styles.detailedStatHeader}>
                <Ionicons name="ribbon" size={16} color={themeColors.secondary} />
                <Text style={[styles.detailedStatLabel, { color: themeColors.textSecondary }]}>To Goal</Text>
              </View>
              <Text style={[styles.detailedStatValue, { color: themeColors.secondary }]}>
                {prefs.weightUnit === 'lbs'
                  ? (stats.weightToGoal * 2.205).toFixed(1)
                  : stats.weightToGoal.toFixed(1)}
              </Text>
              <Text style={[styles.detailedStatSubtext, { color: themeColors.textSecondary }]}>{weightUnit} left</Text>
            </View>
          )}

          {/* Weeks To Goal */}
          {stats.weeksToGoal && (
            <View style={[styles.detailedStatCard, { borderLeftColor: themeColors.accent, backgroundColor: themeColors.surface }]}>
              <View style={styles.detailedStatHeader}>
                <Ionicons name="calendar" size={16} color={themeColors.accent} />
                <Text style={[styles.detailedStatLabel, { color: themeColors.textSecondary }]}>ETA</Text>
              </View>
              <Text style={[styles.detailedStatValue, { color: themeColors.accent }]}>
                {stats.weeksToGoal}
              </Text>
              <Text style={[styles.detailedStatSubtext, { color: themeColors.textSecondary }]}>weeks to goal</Text>
            </View>
          )}

          {/* Total Entries */}
          <View style={[styles.detailedStatCard, { borderLeftColor: themeColors.primary, backgroundColor: themeColors.surface }]}>
            <View style={styles.detailedStatHeader}>
              <Ionicons name="list" size={16} color={themeColors.primary} />
              <Text style={[styles.detailedStatLabel, { color: themeColors.textSecondary }]}>Entries</Text>
            </View>
            <Text style={[styles.detailedStatValue, { color: themeColors.primary }]}>
              {stats.totalEntries}
            </Text>
            <Text style={[styles.detailedStatSubtext, { color: themeColors.textSecondary }]}>weight logs</Text>
          </View>
        </View>
      </Animated.View>

      {/* Medication Quick Card */}
      <Animated.View style={{
        opacity: medCardAnim,
        transform: [
          { translateY: medCardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
        ],
      }}>
        <TouchableOpacity 
          style={[styles.zepboundCard, { backgroundColor: themeColors.surface }]}
          onPress={() => navigation.navigate('Meds' as never)}
          activeOpacity={0.8}
        >
        <View style={styles.zepboundLeft}>
          <View style={[styles.zepboundIcon, { backgroundColor: themeColors.secondaryLight }]}>
            <Ionicons name="medical" size={22} color={themeColors.secondary} />
          </View>
          <View>
            <Text style={[styles.zepboundTitle, { color: themeColors.text }]}>Medication</Text>
            <Text style={[styles.zepboundSubtitle, { color: themeColors.textSecondary }]}>
              {stats.latestDose ? `${stats.latestDose}mg Zepbound` : 'Track your shots'}
            </Text>
          </View>
        </View>
        {stats.nextShotDue && (
          <View style={styles.zepboundRight}>
            <Text style={[styles.nextShotLabel, { color: themeColors.textSecondary }]}>Next Shot</Text>
            <Text style={[styles.nextShotDate, { color: themeColors.secondary }]}>{stats.nextShotDue}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Motivation Tip */}
      {prefs.showMotivation && motivationTip !== '' && (
        <Animated.View style={[styles.insightsSection, {
          opacity: insightsAnim,
          transform: [
            { translateY: insightsAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
          ],
        }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles" size={20} color={themeColors.primary} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Daily Tip</Text>
          </View>
          <View style={[styles.insightCard, { backgroundColor: themeColors.surface }]}>
            <View style={[styles.insightIcon, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="bulb" size={18} color="#fff" />
            </View>
            <View style={styles.insightContent}>
              <Text style={[styles.insightText, { color: themeColors.textSecondary }]}>{motivationTip}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  heroGradient: {
    padding: spacing.lg,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  heroWeightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  heroWeight: {
    color: colors.textOnPrimary,
    fontSize: 52,
    fontWeight: '700',
  },
  heroUnit: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 20,
    fontWeight: '500',
    marginLeft: spacing.xs,
  },
  goalSection: {
    marginTop: spacing.lg,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.textOnPrimary,
    borderRadius: 4,
  },
  goalLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  goalText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  progressText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    borderTopWidth: 3,
    ...shadows.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  zepboundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  zepboundLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zepboundIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  zepboundTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  zepboundSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  zepboundRight: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  nextShotLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  nextShotDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
  },
  insightsSection: {
    marginBottom: spacing.md,
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
  insightCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  insightContent: {
    flex: 1,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  greetingSection: {
    marginBottom: spacing.md,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  greetingSubtext: {
    fontSize: 14,
  },
  detailedStatsSection: {
    marginBottom: spacing.lg,
  },
  detailedStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  detailedStatCard: {
    width: '48%',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: '1%',
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    ...shadows.sm,
  },
  detailedStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  detailedStatLabel: {
    fontSize: 12,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
  detailedStatValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  detailedStatSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
});
