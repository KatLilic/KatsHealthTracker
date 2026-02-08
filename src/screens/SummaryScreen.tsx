import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO, differenceInDays, differenceInWeeks } from 'date-fns';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import {
  getWeightEntries,
  getUserProfile,
  getMeasurements,
  getZepboundStats,
  getZepboundShots,
  getComprehensiveStats,
  getAverageProtein,
} from '../database/db';
import { useTheme } from '../theme/ThemeContext';

// AIML API Configuration
const API_BASE = 'https://api.aimlapi.com/v1/chat/completions';
const AIML_API_KEY = '07ca0cb8d6e1417ba82420fdc3054fc6';
const SUMMARY_CACHE_KEY = '@health_tracker_ai_summary';
const SUMMARY_CACHE_TIME = 30 * 60 * 1000; // 30 minutes (reduced for easier testing)

interface SummaryData {
  timestamp: number;
  overallProgress: string;
  weeklyHighlight: string;
  medicationInsight: string;
  nextSteps: string[];
  motivationalNote: string;
}

interface HealthData {
  currentWeight: number | null;
  startWeight: number | null;
  goalWeight: number | null;
  totalLost: number;
  weeklyAvg: number;
  weeksToGoal: number | null;
  currentDose: number | null;
  totalShots: number;
  daysOnMeds: number;
  lastShotDate: string | null;
  bmi: number | null;
  userName: string | null;
  // New nutrition fields
  avgProtein7Day: number;
  avgProtein30Day: number;
  proteinDaysTracked: number;
  weeklyWeightChange: number | null;
  monthlyWeightChange: number | null;
  totalMeasurements: number;
}

export default function SummaryScreen() {
  const { themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const runAnimations = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadHealthData = async (): Promise<HealthData> => {
    const [weights, profile, zepStats, shots, measurements, comprehensiveStats] = await Promise.all([
      getWeightEntries(),
      getUserProfile(),
      getZepboundStats(),
      getZepboundShots(),
      getMeasurements(),
      getComprehensiveStats(),
    ]);

    const currentWeight = weights[0]?.weight_kg ? weights[0].weight_kg * 2.205 : null;
    const startWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg * 2.205 : null;
    const goalWeight = profile?.goal_weight_kg ? profile.goal_weight_kg * 2.205 : null;
    
    let totalLost = 0;
    let weeklyAvg = 0;
    let weeksToGoal = null;
    
    if (startWeight && currentWeight) {
      totalLost = startWeight - currentWeight;
      if (weights.length > 1) {
        const firstDate = parseISO(weights[weights.length - 1].date);
        const weeks = Math.max(1, differenceInWeeks(new Date(), firstDate));
        weeklyAvg = totalLost / weeks;
        if (goalWeight && currentWeight > goalWeight && weeklyAvg > 0) {
          weeksToGoal = Math.ceil((currentWeight - goalWeight) / weeklyAvg);
        }
      }
    }

    let bmi = null;
    if (profile?.height_cm && currentWeight) {
      const heightM = profile.height_cm / 100;
      bmi = (currentWeight / 2.205) / (heightM * heightM);
    }

    let daysOnMeds = 0;
    if (zepStats.firstShotDate) {
      daysOnMeds = differenceInDays(new Date(), parseISO(zepStats.firstShotDate));
    }

    // Calculate weekly and monthly weight changes
    const weeklyWeightChange = comprehensiveStats.weight.weeklyChange 
      ? comprehensiveStats.weight.weeklyChange * 2.205 
      : null;
    const monthlyWeightChange = comprehensiveStats.weight.monthlyChange 
      ? comprehensiveStats.weight.monthlyChange * 2.205 
      : null;

    return {
      currentWeight,
      startWeight,
      goalWeight,
      totalLost,
      weeklyAvg,
      weeksToGoal,
      currentDose: zepStats.currentDose,
      totalShots: zepStats.totalShots,
      daysOnMeds,
      lastShotDate: zepStats.latestShotDate,
      bmi,
      userName: profile?.name || null,
      // New nutrition fields
      avgProtein7Day: comprehensiveStats.nutrition.avgProtein7Day,
      avgProtein30Day: comprehensiveStats.nutrition.avgProtein30Day,
      proteinDaysTracked: comprehensiveStats.nutrition.proteinDaysTracked,
      weeklyWeightChange,
      monthlyWeightChange,
      totalMeasurements: measurements.length,
    };
  };

  const generateAISummary = async (data: HealthData): Promise<SummaryData> => {
    const prompt = `You are a supportive health assistant for someone on Zepbound (tirzepatide) for weight loss. Based on this comprehensive health data, provide a personalized summary in JSON format. Be encouraging, specific, and data-driven.

HEALTH DATA:
Weight Progress:
- Current weight: ${data.currentWeight?.toFixed(1) || 'Not logged'} lbs
- Starting weight: ${data.startWeight?.toFixed(1) || 'Not logged'} lbs  
- Goal weight: ${data.goalWeight?.toFixed(0) || 'Not set'} lbs
- Total lost: ${data.totalLost > 0 ? data.totalLost.toFixed(1) : '0'} lbs
- Weekly average loss: ${data.weeklyAvg > 0 ? data.weeklyAvg.toFixed(2) : '0'} lbs/week
- This week's change: ${data.weeklyWeightChange !== null ? (data.weeklyWeightChange > 0 ? '+' : '') + data.weeklyWeightChange.toFixed(1) : 'N/A'} lbs
- This month's change: ${data.monthlyWeightChange !== null ? (data.monthlyWeightChange > 0 ? '+' : '') + data.monthlyWeightChange.toFixed(1) : 'N/A'} lbs
- Weeks to goal: ${data.weeksToGoal || 'N/A'}
- BMI: ${data.bmi?.toFixed(1) || 'N/A'}

Nutrition:
- 7-day avg protein: ${data.avgProtein7Day > 0 ? data.avgProtein7Day.toFixed(0) + 'g' : 'Not tracked'}
- 30-day avg protein: ${data.avgProtein30Day > 0 ? data.avgProtein30Day.toFixed(0) + 'g' : 'Not tracked'}
- Days with protein logged: ${data.proteinDaysTracked}

Medication (Zepbound):
- Current dose: ${data.currentDose || 'Not started'} mg
- Total shots: ${data.totalShots}
- Days on medication: ${data.daysOnMeds}

Tracking:
- Body measurements logged: ${data.totalMeasurements}

Provide analysis that includes protein's role in preserving muscle during weight loss. Recommended protein is 0.7-1g per pound of goal weight (${data.goalWeight ? Math.round(data.goalWeight * 0.8) + 'g' : '80-120g'} daily).

Return ONLY valid JSON with this exact structure:
{
  "overallProgress": "2-3 sentence summary of overall progress including weight and nutrition",
  "weeklyHighlight": "1-2 sentence highlight about this week's trends and protein intake",
  "medicationInsight": "1-2 sentences about medication progress, dose titration, and what to expect",
  "nextSteps": ["specific action 1", "specific action 2", "specific action 3"],
  "motivationalNote": "1 personalized encouraging sentence"
}`;

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AIML_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a health assistant. Respond only with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content || '';
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          timestamp: Date.now(),
          overallProgress: parsed.overallProgress || 'Keep tracking your progress!',
          weeklyHighlight: parsed.weeklyHighlight || 'Stay consistent with your logging.',
          medicationInsight: parsed.medicationInsight || 'Follow your prescribed schedule.',
          nextSteps: parsed.nextSteps || ['Log your weight daily', 'Stay hydrated', 'Get enough protein'],
          motivationalNote: parsed.motivationalNote || "You're doing great! Keep it up!",
        };
      }
      throw new Error('Invalid response format');
    } catch (e) {
      console.log('AI Summary error:', e);
      // Fallback summary
      return generateFallbackSummary(data);
    }
  };

  const generateFallbackSummary = (data: HealthData): SummaryData => {
    let overallProgress = "Start logging your weight and shots to see your progress summary!";
    let weeklyHighlight = "Track consistently to see weekly trends.";
    let medicationInsight = "Log your Zepbound shots to track your medication journey.";
    const nextSteps: string[] = [];
    let motivationalNote = "Every journey starts with a single step. You've got this! 💪";

    if (data.totalLost > 0) {
      overallProgress = `Amazing progress! You've lost ${data.totalLost.toFixed(1)} lbs since starting your journey.`;
      if (data.weeklyAvg > 0) {
        overallProgress += ` That's an average of ${data.weeklyAvg.toFixed(2)} lbs per week - right on track!`;
      }
    }

    if (data.weeksToGoal) {
      weeklyHighlight = `At your current pace, you could reach your goal of ${data.goalWeight?.toFixed(0)} lbs in about ${data.weeksToGoal} weeks!`;
    }
    
    // Add protein insight to weekly highlight
    if (data.avgProtein7Day > 0) {
      const targetProtein = data.goalWeight ? Math.round(data.goalWeight * 0.8) : 100;
      if (data.avgProtein7Day < targetProtein * 0.7) {
        weeklyHighlight += ` Your protein intake (${data.avgProtein7Day.toFixed(0)}g avg) is below target - try to hit ${targetProtein}g daily.`;
      } else if (data.avgProtein7Day >= targetProtein) {
        weeklyHighlight += ` Great protein intake at ${data.avgProtein7Day.toFixed(0)}g daily!`;
      }
    }

    if (data.daysOnMeds > 0 && data.currentDose) {
      medicationInsight = `You've been on Zepbound for ${data.daysOnMeds} days at ${data.currentDose}mg. `;
      if (data.daysOnMeds < 28) {
        medicationInsight += "Your body is still adjusting - side effects usually improve over time.";
      } else if (data.currentDose < 15) {
        medicationInsight += "You may titrate up at your next appointment for continued progress.";
      } else {
        medicationInsight += "You're on the maintenance dose - focus on maximizing results with lifestyle!";
      }
    }

    // Build personalized next steps
    nextSteps.push("Log your weight today");
    
    if (data.avgProtein7Day === 0 || data.proteinDaysTracked < 3) {
      nextSteps.push("Start tracking protein (aim for 80-120g daily)");
    } else {
      const targetProtein = data.goalWeight ? Math.round(data.goalWeight * 0.8) : 100;
      nextSteps.push(`Hit ${targetProtein}g protein today`);
    }
    
    nextSteps.push("Stay hydrated (64+ oz water)");

    return {
      timestamp: Date.now(),
      overallProgress,
      weeklyHighlight,
      medicationInsight,
      nextSteps,
      motivationalNote,
    };
  };

  const loadSummary = async (forceRefresh = false) => {
    try {
      setError(null);
      
      // Load health data first
      const data = await loadHealthData();
      setHealthData(data);

      // Check cache
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(SUMMARY_CACHE_KEY);
        if (cached) {
          const parsedCache = JSON.parse(cached) as SummaryData;
          if (Date.now() - parsedCache.timestamp < SUMMARY_CACHE_TIME) {
            setSummary(parsedCache);
            setIsLoading(false);
            runAnimations();
            return;
          }
        }
      } else {
        // Clear cache on force refresh
        await AsyncStorage.removeItem(SUMMARY_CACHE_KEY);
      }

      // Generate new summary
      const newSummary = await generateAISummary(data);
      setSummary(newSummary);
      await AsyncStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(newSummary));
      runAnimations();
    } catch (e) {
      console.error('Failed to load summary:', e);
      setError('Failed to generate summary. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadSummary(true);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={themeColors.primary} />
        <View style={[styles.header, { backgroundColor: themeColors.primary, paddingTop: insets.top }]}>
          <Text style={styles.headerTitle}>AI Summary</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Analyzing your progress...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={themeColors.primary} />
      <View style={[styles.header, { backgroundColor: themeColors.primary, paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>AI Summary</Text>
            <Text style={styles.headerSubtitle}>Personalized insights from your data</Text>
          </View>
          <TouchableOpacity
            style={styles.regenerateButton}
            onPress={onRefresh}
            disabled={isRefreshing}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
          />
        }
      >
        {error ? (
          <View style={[styles.errorCard, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="alert-circle" size={40} color={colors.error} />
            <Text style={[styles.errorText, { color: themeColors.text }]}>{error}</Text>
          </View>
        ) : summary && (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Quick Stats */}
            {healthData && (
              <View style={[styles.statsRow, { backgroundColor: themeColors.surface }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: themeColors.primary }]}>
                    {healthData.currentWeight?.toFixed(1) || '--'}
                  </Text>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Current lbs</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: themeColors.background }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {healthData.totalLost > 0 ? `-${healthData.totalLost.toFixed(1)}` : '0'}
                  </Text>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Total Lost</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: themeColors.background }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: themeColors.secondary }]}>
                    {healthData.currentDose || '--'}mg
                  </Text>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Dose</Text>
                </View>
              </View>
            )}

            {/* Protein Stats Row */}
            {healthData && (
              <View style={[styles.statsRow, { backgroundColor: themeColors.surface, marginTop: spacing.sm }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: themeColors.accent }]}>
                    {healthData.avgProtein7Day > 0 ? `${healthData.avgProtein7Day.toFixed(0)}g` : '--'}
                  </Text>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>7-Day Protein</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: themeColors.background }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: themeColors.accent }]}>
                    {healthData.avgProtein30Day > 0 ? `${healthData.avgProtein30Day.toFixed(0)}g` : '--'}
                  </Text>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>30-Day Avg</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: themeColors.background }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: themeColors.textSecondary }]}>
                    {healthData.proteinDaysTracked || 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Days Logged</Text>
                </View>
              </View>
            )}

            {/* Overall Progress */}
            <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: themeColors.primaryLight }]}>
                  <Ionicons name="trending-up" size={20} color={themeColors.primaryDark} />
                </View>
                <Text style={[styles.cardTitle, { color: themeColors.text }]}>Overall Progress</Text>
              </View>
              <Text style={[styles.cardContent, { color: themeColors.textSecondary }]}>
                {summary.overallProgress}
              </Text>
            </View>

            {/* Weekly Highlight */}
            <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: themeColors.accentLight }]}>
                  <Ionicons name="star" size={20} color={themeColors.accentDark} />
                </View>
                <Text style={[styles.cardTitle, { color: themeColors.text }]}>This Week</Text>
              </View>
              <Text style={[styles.cardContent, { color: themeColors.textSecondary }]}>
                {summary.weeklyHighlight}
              </Text>
            </View>

            {/* Medication Insight */}
            <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: themeColors.secondaryLight }]}>
                  <Ionicons name="medical" size={20} color={themeColors.secondaryDark} />
                </View>
                <Text style={[styles.cardTitle, { color: themeColors.text }]}>Medication</Text>
              </View>
              <Text style={[styles.cardContent, { color: themeColors.textSecondary }]}>
                {summary.medicationInsight}
              </Text>
            </View>

            {/* Next Steps */}
            <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                </View>
                <Text style={[styles.cardTitle, { color: themeColors.text }]}>Next Steps</Text>
              </View>
              {summary.nextSteps.map((step, idx) => (
                <View key={idx} style={styles.stepItem}>
                  <View style={[styles.stepBullet, { backgroundColor: themeColors.primary }]}>
                    <Text style={styles.stepNumber}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: themeColors.textSecondary }]}>{step}</Text>
                </View>
              ))}
            </View>

            {/* Motivational Note */}
            <View style={[styles.motivationCard, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="heart" size={24} color="#fff" />
              <Text style={styles.motivationText}>{summary.motivationalNote}</Text>
            </View>

            {/* Last Updated */}
            <Text style={[styles.lastUpdated, { color: themeColors.textSecondary }]}>
              Last updated: {format(summary.timestamp, 'MMM d, h:mm a')}
            </Text>
          </Animated.View>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regenerateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    marginVertical: 4,
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  stepBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  stepNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  motivationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  motivationText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: spacing.md,
    lineHeight: 22,
  },
  lastUpdated: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.sm,
  },
  errorCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
