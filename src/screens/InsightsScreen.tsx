import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO, differenceInDays, differenceInWeeks } from 'date-fns';
import {
  getWeightEntries,
  getMeasurements,
  getZepboundStats,
  getZepboundShots,
  getUserProfile,
  WeightEntry,
  MeasurementEntry,
} from '../database/db';
import { useTheme } from '../theme/ThemeContext';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

interface Insight {
  id: string;
  title: string;
  content: string;
  icon: string;
  color: string;
  category: 'milestone' | 'trend' | 'tip' | 'motivation' | 'alert';
}

function generateInsights(
  weights: WeightEntry[],
  measurements: MeasurementEntry[],
  zepStats: any,
  zepShots: any[],
  profile: any,
  themeColors: any,
): Insight[] {
  const insights: Insight[] = [];

  // Weight-based insights
  if (weights.length > 0) {
    const currentW = weights[0].weight_kg * 2.205;
    const goalW = profile?.goal_weight_kg ? profile.goal_weight_kg * 2.205 : null;

    // Total loss
    if (weights.length > 1) {
      const firstW = weights[weights.length - 1].weight_kg * 2.205;
      const totalLost = firstW - currentW;
      if (totalLost > 0) {
        insights.push({
          id: 'total-loss',
          title: `${totalLost.toFixed(1)} lbs Lost Total!`,
          content: `You started at ${firstW.toFixed(1)} lbs and are now at ${currentW.toFixed(1)} lbs. That's incredible progress! Keep doing what you're doing.`,
          icon: 'trophy',
          color: colors.success,
          category: 'milestone',
        });
      }
    }

    // Goal progress
    if (goalW && weights.length > 1) {
      const firstW = weights[weights.length - 1].weight_kg * 2.205;
      const totalToLose = firstW - goalW;
      const lost = firstW - currentW;
      if (totalToLose > 0 && lost > 0) {
        const pct = Math.min(100, (lost / totalToLose) * 100);
        insights.push({
          id: 'goal-progress',
          title: `${pct.toFixed(0)}% to Your Goal!`,
          content: pct >= 100
            ? `You've reached your goal of ${goalW.toFixed(0)} lbs! Time to celebrate and set a new goal!`
            : `Only ${(currentW - goalW).toFixed(1)} lbs to go. You're ${pct.toFixed(0)}% of the way to ${goalW.toFixed(0)} lbs.`,
          icon: pct >= 100 ? 'star' : 'flag',
          color: pct >= 100 ? '#FFD700' : themeColors.primary,
          category: 'milestone',
        });
      }
    }

    // 7-day trend
    if (weights.length >= 2) {
      const now = new Date();
      const weekAgo = weights.find(w => differenceInDays(now, parseISO(w.date)) >= 7);
      if (weekAgo) {
        const change = (weekAgo.weight_kg - weights[0].weight_kg) * 2.205;
        if (change > 0) {
          insights.push({
            id: 'week-trend',
            title: `Down ${change.toFixed(1)} lbs This Week`,
            content: `Great consistent progress! Losing 1-2 lbs per week is considered a healthy and sustainable rate.`,
            icon: 'trending-down',
            color: colors.success,
            category: 'trend',
          });
        } else if (change < -0.5) {
          insights.push({
            id: 'week-trend',
            title: 'Weight Fluctuation Detected',
            content: `Your weight went up by ${Math.abs(change).toFixed(1)} lbs this week. This is normal! Water retention, sodium, hormones, and muscle gain can all cause temporary increases.`,
            icon: 'water',
            color: colors.warning,
            category: 'trend',
          });
        } else {
          insights.push({
            id: 'week-plateau',
            title: 'Holding Steady',
            content: `Your weight has been stable this week. Plateaus are a normal part of weight loss. Your body is adjusting — keep going!`,
            icon: 'pause-circle',
            color: themeColors.accent,
            category: 'trend',
          });
        }
      }
    }

    // Consistency check
    if (weights.length >= 3) {
      const lastThree = weights.slice(0, 3);
      const daysBetween = differenceInDays(parseISO(lastThree[0].date), parseISO(lastThree[2].date));
      if (daysBetween <= 10) {
        insights.push({
          id: 'consistency',
          title: 'Consistent Tracking! ✨',
          content: `You've been logging weight regularly. Consistent tracking is one of the best predictors of long-term success.`,
          icon: 'checkmark-circle',
          color: themeColors.primary,
          category: 'motivation',
        });
      }
    }

    // Lowest weight milestone
    const allWeights = weights.map(w => w.weight_kg);
    if (weights[0].weight_kg === Math.min(...allWeights) && weights.length > 3) {
      insights.push({
        id: 'new-low',
        title: 'New Lowest Weight! 🎉',
        content: `${currentW.toFixed(1)} lbs is your lowest recorded weight. You're making real progress!`,
        icon: 'ribbon',
        color: '#FFD700',
        category: 'milestone',
      });
    }

    // BMI insight
    if (profile?.height_cm) {
      const heightM = profile.height_cm / 100;
      const bmi = weights[0].weight_kg / (heightM * heightM);
      if (bmi < 25 && weights.length > 3) {
        const firstBMI = weights[weights.length - 1].weight_kg / (heightM * heightM);
        if (firstBMI >= 25) {
          insights.push({
            id: 'bmi-normal',
            title: 'Healthy BMI Reached!',
            content: `Your BMI is now ${bmi.toFixed(1)}, which is in the normal range. You went from ${firstBMI.toFixed(1)} — incredible achievement!`,
            icon: 'heart',
            color: colors.success,
            category: 'milestone',
          });
        }
      }
    }
  }

  // Measurement insights
  if (measurements.length >= 2) {
    const latest = measurements[0];
    const first = measurements[measurements.length - 1];

    // Waist change
    if (latest.waist_cm && first.waist_cm) {
      const change = (first.waist_cm - latest.waist_cm) / 2.54;
      if (change > 0) {
        insights.push({
          id: 'waist-loss',
          title: `${change.toFixed(1)}" Lost from Waist`,
          content: `Your waist has gone from ${(first.waist_cm / 2.54).toFixed(1)}" to ${(latest.waist_cm / 2.54).toFixed(1)}". Reducing waist size is especially beneficial for health.`,
          icon: 'resize',
          color: themeColors.secondary,
          category: 'milestone',
        });
      }
    }

    // Total inches lost
    const measKeys = ['waist_cm', 'hips_cm', 'rib_cage_cm', 'left_arm_cm', 'right_arm_cm', 'left_thigh_cm', 'right_thigh_cm'];
    let totalInchesLost = 0;
    measKeys.forEach(key => {
      const latestVal = (latest as any)[key];
      const firstVal = (first as any)[key];
      if (latestVal != null && firstVal != null && firstVal > latestVal) {
        totalInchesLost += (firstVal - latestVal) / 2.54;
      }
    });

    if (totalInchesLost > 1) {
      insights.push({
        id: 'total-inches',
        title: `${totalInchesLost.toFixed(1)}" Total Inches Lost`,
        content: `Across your tracked measurements, you've lost ${totalInchesLost.toFixed(1)} total inches. Your body is reshaping even when the scale doesn't move!`,
        icon: 'body',
        color: themeColors.accent,
        category: 'milestone',
      });
    }
  }

  // Zepbound insights
  if (zepStats && zepStats.totalShots > 0) {
    insights.push({
      id: 'zep-journey',
      title: `${zepStats.totalShots} Zepbound Shots Completed`,
      content: zepStats.weightLostSinceStart > 0
        ? `You've been on Zepbound for ${differenceInWeeks(new Date(), parseISO(zepStats.firstShotDate))} weeks and lost ${(zepStats.weightLostSinceStart * 2.205).toFixed(1)} lbs since starting.`
        : `You've been on Zepbound for ${differenceInWeeks(new Date(), parseISO(zepStats.firstShotDate))} weeks. Keep it up!`,
      icon: 'medical',
      color: themeColors.secondary,
      category: 'milestone',
    });

    // Shot reminder
    if (zepStats.latestShotDate) {
      const daysSince = differenceInDays(new Date(), parseISO(zepStats.latestShotDate));
      if (daysSince >= 6) {
        insights.push({
          id: 'shot-reminder',
          title: daysSince >= 7 ? 'Shot Due!' : 'Shot Coming Up',
          content: daysSince >= 7
            ? `It's been ${daysSince} days since your last Zepbound shot. Time to log your next one!`
            : `Your next Zepbound shot is tomorrow. Make sure you have everything ready!`,
          icon: 'alert-circle',
          color: daysSince >= 7 ? colors.error : colors.warning,
          category: 'alert',
        });
      }
    }

    // Dose escalation
    if (zepShots.length >= 2) {
      const latestDose = zepShots[0].dose_mg;
      const prevDose = zepShots[1].dose_mg;
      if (latestDose > prevDose) {
        insights.push({
          id: 'dose-up',
          title: `Dose Increased to ${latestDose}mg`,
          content: `You moved from ${prevDose}mg to ${latestDose}mg. It can take a few weeks to fully feel the effects of a dose increase. Be patient!`,
          icon: 'arrow-up-circle',
          color: themeColors.secondary,
          category: 'trend',
        });
      }
    }
  }

  // General tips (always show a few)
  const tips: Insight[] = [
    {
      id: 'tip-water',
      title: 'Stay Hydrated',
      content: 'Drinking 64+ oz of water daily supports metabolism and can help manage Zepbound side effects like nausea. Try setting hourly reminders!',
      icon: 'water',
      color: themeColors.accent,
      category: 'tip',
    },
    {
      id: 'tip-protein',
      title: 'Prioritize Protein',
      content: 'Aim for 80-100g of protein daily while on Zepbound to preserve muscle mass during weight loss. Eggs, chicken, greek yogurt, and protein shakes are great options.',
      icon: 'nutrition',
      color: colors.success,
      category: 'tip',
    },
    {
      id: 'tip-sleep',
      title: 'Sleep Matters',
      content: 'Getting 7-9 hours of quality sleep is crucial for weight loss. Poor sleep increases hunger hormones and can slow your progress.',
      icon: 'moon',
      color: themeColors.secondary,
      category: 'tip',
    },
    {
      id: 'tip-movement',
      title: 'Move Your Body',
      content: 'Even 20-30 minutes of walking daily can make a big difference! Exercise helps preserve muscle, boost mood, and accelerate fat loss.',
      icon: 'walk',
      color: themeColors.primary,
      category: 'tip',
    },
    {
      id: 'tip-measure',
      title: 'Track Beyond the Scale',
      content: 'The scale only tells part of the story. Taking body measurements shows changes in body composition that weight alone can\'t capture.',
      icon: 'resize-outline',
      color: themeColors.accent,
      category: 'tip',
    },
    {
      id: 'tip-patience',
      title: 'Trust the Process',
      content: 'Weight loss isn\'t linear — expect ups and downs. Focus on weekly and monthly trends rather than daily fluctuations.',
      icon: 'time',
      color: colors.warning,
      category: 'tip',
    },
  ];

  // Rotate tips based on day of year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const tipIndex = dayOfYear % tips.length;
  const selectedTips = [tips[tipIndex], tips[(tipIndex + 1) % tips.length]];
  insights.push(...selectedTips);

  return insights;
}

export default function InsightsScreen() {
  const { themeColors, prefs, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'milestone' | 'trend' | 'tip'>('all');

  const loadInsights = async () => {
    try {
      const [weights, measurements, zepStats, shots, profile] = await Promise.all([
        getWeightEntries(),
        getMeasurements(),
        getZepboundStats(),
        getZepboundShots(),
        getUserProfile(),
      ]);
      const generated = generateInsights(weights, measurements, zepStats, shots, profile, themeColors);
      setInsights(generated);
    } catch (e) {
      console.error('Failed to load insights:', e);
    }
  };

  useFocusEffect(useCallback(() => { loadInsights(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInsights();
    setRefreshing(false);
  };

  const filtered = filter === 'all' ? insights : insights.filter(i => i.category === filter);

  const categoryOrder = ['alert', 'milestone', 'trend', 'motivation', 'tip'];
  const sorted = [...filtered].sort(
    (a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
  );

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'milestone': return '🏆 MILESTONE';
      case 'trend': return '📊 TREND';
      case 'tip': return '💡 TIP';
      case 'motivation': return '✨ MOTIVATION';
      case 'alert': return '⚡ ALERT';
      default: return cat.toUpperCase();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={themeColors.primary} />
      {/* Header with back button - extends into status bar */}
      <View style={[styles.headerBar, { backgroundColor: themeColors.primary, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Insights</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: themeColors.background }]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Your Insights</Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
            Personalized tips and milestones based on your data
          </Text>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {([
            { key: 'all', label: 'All', icon: 'apps-outline' },
            { key: 'milestone', label: 'Milestones', icon: 'trophy-outline' },
            { key: 'trend', label: 'Trends', icon: 'analytics-outline' },
            { key: 'tip', label: 'Tips', icon: 'bulb-outline' },
          ] as const).map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, { backgroundColor: themeColors.surface }, filter === f.key && { backgroundColor: themeColors.primary }]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons name={f.icon as any} size={16} color={filter === f.key ? '#fff' : themeColors.textSecondary} />
              <Text style={[styles.filterText, { color: themeColors.textSecondary }, filter === f.key && { color: '#fff' }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Insights */}
        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={60} color={themeColors.primaryLight} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No insights yet</Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              Start logging your weight, measurements, and Zepbound shots to get personalized insights!
            </Text>
          </View>
        ) : (
          sorted.map((insight, idx) => (
            <View key={insight.id + idx} style={[styles.insightCard, { backgroundColor: themeColors.surface }]}>
              <View style={styles.insightHeader}>
                <View style={[styles.insightIcon, { backgroundColor: insight.color }]}>
                  <Ionicons name={insight.icon as any} size={20} color="#fff" />
                </View>
                <View style={styles.insightHeaderText}>
                  <Text style={[styles.insightCategory, { color: themeColors.textSecondary }]}>{getCategoryLabel(insight.category)}</Text>
                  <Text style={[styles.insightTitle, { color: themeColors.text }]}>{insight.title}</Text>
                </View>
              </View>
              <Text style={[styles.insightContent, { color: themeColors.textSecondary }]}>{insight.content}</Text>
            </View>
          ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  filterRow: {
    marginBottom: spacing.md,
    maxHeight: 44,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: spacing.sm,
    borderRadius: borderRadius.round,
    gap: 4,
    ...shadows.sm,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  insightCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  insightHeaderText: {
    flex: 1,
  },
  insightCategory: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  insightContent: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 52,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
});
