import React, { useState, useCallback, useMemo } from 'react';
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
import Svg, { Path, Circle, Line, Rect, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, G } from 'react-native-svg';
import { format, parseISO, subMonths, differenceInDays } from 'date-fns';
import {
  getWeightEntries,
  getMeasurements,
  getZepboundShots,
  getZepboundStats,
  getUserProfile,
  WeightEntry,
  MeasurementEntry,
  ZepboundEntry,
} from '../database/db';
import { useTheme, THEME_PRESETS } from '../theme/ThemeContext';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

const screenWidth = Dimensions.get('window').width;
const CHART_WIDTH = screenWidth - 64;
const CHART_HEIGHT = 180;
const CHART_PADDING = { top: 20, right: 15, bottom: 30, left: 50 };

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
type ChartTab = 'weight' | 'measurements' | 'zepbound' | 'bmi';

// Helper: build SVG line path
function buildLinePath(
  points: { x: number; y: number }[],
  curved: boolean = true
): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  if (curved && points.length > 2) {
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
  } else {
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
  }
  return d;
}

// Helper: build SVG fill area path
function buildAreaPath(
  points: { x: number; y: number }[],
  baseY: number,
  curved: boolean = true
): string {
  if (points.length < 2) return '';
  let d = buildLinePath(points, curved);
  d += ` L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
  return d;
}

// Scale data to chart coordinates
function scalePoints(
  data: number[],
  width: number,
  height: number,
  padding: typeof CHART_PADDING,
  minOverride?: number,
  maxOverride?: number,
) {
  if (data.length === 0) return { points: [], minVal: 0, maxVal: 0, yLabels: [] };
  
  const minVal = minOverride ?? Math.min(...data);
  const maxVal = maxOverride ?? Math.max(...data);
  const range = maxVal - minVal || 1;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((val, i) => ({
    x: padding.left + (i / Math.max(1, data.length - 1)) * chartW,
    y: padding.top + (1 - (val - minVal) / range) * chartH,
  }));

  // Y-axis labels (5 steps)
  const yLabels = Array.from({ length: 5 }, (_, i) => {
    const val = minVal + (range * i) / 4;
    const y = padding.top + (1 - i / 4) * chartH;
    return { val, y };
  });

  return { points, minVal, maxVal, yLabels };
}

export default function ChartsScreen() {
  const { themeColors, prefs } = useTheme();
  const [activeTab, setActiveTab] = useState<ChartTab>('weight');
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>([]);
  const [zepShots, setZepShots] = useState<ZepboundEntry[]>([]);
  const [zepStats, setZepStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState('waist_cm');

  const isLbs = prefs.weightUnit === 'lbs';
  const isInches = prefs.measurementUnit === 'in';
  const curved = prefs.chartStyle === 'curved';

  const loadData = async () => {
    try {
      const [w, m, z, zs, p] = await Promise.all([
        getWeightEntries(),
        getMeasurements(),
        getZepboundShots(),
        getZepboundStats(),
        getUserProfile(),
      ]);
      setWeights(w);
      setMeasurements(m);
      setZepShots(z);
      setZepStats(zs);
      setProfile(p);
    } catch (e) {
      console.error('Charts load error:', e);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // Filter by time range
  const filterByTime = <T extends { date: string }>(data: T[]): T[] => {
    const now = new Date();
    let cutoff: Date;
    switch (timeRange) {
      case '1W': cutoff = new Date(now.getTime() - 7 * 86400000); break;
      case '1M': cutoff = subMonths(now, 1); break;
      case '3M': cutoff = subMonths(now, 3); break;
      case '6M': cutoff = subMonths(now, 6); break;
      case '1Y': cutoff = subMonths(now, 12); break;
      default: cutoff = new Date(0);
    }
    return data.filter(d => parseISO(d.date) >= cutoff);
  };

  const filteredWeights = useMemo(() => filterByTime(weights).reverse(), [weights, timeRange]);
  const filteredMeas = useMemo(() => filterByTime(measurements).reverse(), [measurements, timeRange]);
  const filteredShots = useMemo(() => filterByTime(zepShots).reverse(), [zepShots, timeRange]);

  const convertWeight = (kg: number) => isLbs ? kg * 2.205 : kg;
  const weightUnit = isLbs ? 'lbs' : 'kg';
  const convertMeas = (cm: number) => isInches ? cm / 2.54 : cm;
  const measUnit = isInches ? 'in' : 'cm';

  // Compute stats
  const weightStats = useMemo(() => {
    if (filteredWeights.length === 0) return null;
    const values = filteredWeights.map(w => convertWeight(w.weight_kg));
    const first = values[0];
    const last = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const change = last - first;
    const days = filteredWeights.length > 1
      ? differenceInDays(parseISO(filteredWeights[filteredWeights.length - 1].date), parseISO(filteredWeights[0].date))
      : 0;
    const weeklyAvg = days > 0 ? (change / (days / 7)) : 0;
    return { first, last, min, max, change, weeklyAvg, count: values.length };
  }, [filteredWeights, isLbs]);

  // BMI calculator
  const bmiData = useMemo(() => {
    if (!profile?.height_cm || filteredWeights.length === 0) return null;
    const heightM = profile.height_cm / 100;
    return filteredWeights.map(w => ({
      date: w.date,
      bmi: w.weight_kg / (heightM * heightM),
    }));
  }, [filteredWeights, profile]);

  // Measurement comparison (first vs last)
  const measComparison = useMemo(() => {
    if (filteredMeas.length < 2) return null;
    const first = filteredMeas[0];
    const last = filteredMeas[filteredMeas.length - 1];
    const keys = [
      { key: 'waist_cm', label: 'Waist' },
      { key: 'hips_cm', label: 'Hips' },
      { key: 'rib_cage_cm', label: 'Rib Cage' },
      { key: 'left_arm_cm', label: 'L Arm' },
      { key: 'right_arm_cm', label: 'R Arm' },
      { key: 'left_thigh_cm', label: 'L Thigh' },
      { key: 'right_thigh_cm', label: 'R Thigh' },
    ];
    return keys.map(k => {
      const startVal = (first as any)[k.key];
      const endVal = (last as any)[k.key];
      if (startVal == null || endVal == null) return null;
      return {
        label: k.label,
        start: convertMeas(startVal),
        end: convertMeas(endVal),
        change: convertMeas(endVal - startVal),
      };
    }).filter(Boolean) as { label: string; start: number; end: number; change: number }[];
  }, [filteredMeas, isInches]);

  const MEAS_OPTIONS = [
    { key: 'waist_cm', label: 'Waist' },
    { key: 'hips_cm', label: 'Hips' },
    { key: 'rib_cage_cm', label: 'Rib Cage' },
    { key: 'lower_belly_cm', label: 'Lower Belly' },
    { key: 'left_arm_cm', label: 'L Arm' },
    { key: 'right_arm_cm', label: 'R Arm' },
    { key: 'left_thigh_cm', label: 'L Thigh' },
    { key: 'right_thigh_cm', label: 'R Thigh' },
    { key: 'left_calf_cm', label: 'L Calf' },
    { key: 'right_calf_cm', label: 'R Calf' },
  ];

  // ===== RENDER HELPERS =====

  const renderLineChart = (
    data: number[],
    labels: string[],
    color: string,
    fillColor: string,
    unit: string,
    goalValue?: number,
  ) => {
    if (data.length < 2) {
      return (
        <View style={[s.emptyChart, { borderColor: themeColors.primaryLight }]}>
          <Ionicons name="analytics-outline" size={40} color={themeColors.primaryLight} />
          <Text style={[s.emptyChartText, { color: themeColors.textSecondary }]}>
            Need at least 2 data points
          </Text>
        </View>
      );
    }

    const { points, minVal, maxVal, yLabels } = scalePoints(
      data, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING,
      goalValue ? Math.min(Math.min(...data), goalValue) - 2 : undefined,
      goalValue ? Math.max(Math.max(...data), goalValue) + 2 : undefined,
    );
    const baseY = CHART_HEIGHT - CHART_PADDING.bottom;

    // Sample labels to prevent overlap
    const labelStep = Math.max(1, Math.ceil(labels.length / 6));
    const xLabels = labels.map((l, i) => ({
      label: l,
      x: points[i]?.x ?? 0,
      show: i % labelStep === 0 || i === labels.length - 1,
    }));

    // Goal line
    let goalY: number | null = null;
    if (goalValue !== undefined && goalValue >= minVal && goalValue <= maxVal) {
      const range = maxVal - minVal || 1;
      goalY = CHART_PADDING.top + (1 - (goalValue - minVal) / range) * (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom);
    }

    return (
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </SvgGradient>
        </Defs>

        {/* Grid lines */}
        {yLabels.map((yl, i) => (
          <G key={i}>
            <Line
              x1={CHART_PADDING.left} y1={yl.y}
              x2={CHART_WIDTH - CHART_PADDING.right} y2={yl.y}
              stroke={colors.border} strokeWidth={1} strokeDasharray="4,4"
            />
            <SvgText
              x={CHART_PADDING.left - 6} y={yl.y + 4}
              fontSize={10} fill={colors.textMuted} textAnchor="end"
            >
              {yl.val.toFixed(unit === 'lbs' || unit === 'kg' ? 0 : 1)}
            </SvgText>
          </G>
        ))}

        {/* Goal line */}
        {goalY !== null && prefs.showGoalLine && (
          <G>
            <Line
              x1={CHART_PADDING.left} y1={goalY}
              x2={CHART_WIDTH - CHART_PADDING.right} y2={goalY}
              stroke={colors.success} strokeWidth={1.5} strokeDasharray="6,4"
            />
            <SvgText
              x={CHART_WIDTH - CHART_PADDING.right + 2} y={goalY - 4}
              fontSize={9} fill={colors.successDark} textAnchor="end"
            >
              Goal
            </SvgText>
          </G>
        )}

        {/* Area fill */}
        <Path d={buildAreaPath(points, baseY, curved)} fill="url(#areaGrad)" />
        
        {/* Line */}
        <Path d={buildLinePath(points, curved)} stroke={color} strokeWidth={2.5} fill="none" />

        {/* Dots */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />
        ))}

        {/* X labels */}
        {xLabels.filter(l => l.show).map((l, i) => (
          <SvgText
            key={i} x={l.x} y={CHART_HEIGHT - 6}
            fontSize={10} fill={colors.textMuted} textAnchor="middle"
          >
            {l.label}
          </SvgText>
        ))}
      </Svg>
    );
  };

  const renderBarChart = (
    items: { label: string; value: number; color: string }[],
    unit: string,
  ) => {
    if (items.length === 0) return null;
    const maxVal = Math.max(...items.map(i => Math.abs(i.value)));
    const barH = 32;
    const gap = 8;
    const chartH = items.length * (barH + gap) + 20;
    const barAreaW = CHART_WIDTH - 80;

    return (
      <Svg width={CHART_WIDTH} height={chartH}>
        {items.map((item, i) => {
          const y = i * (barH + gap) + 10;
          const isNeg = item.value < 0;
          const barW = maxVal > 0 ? (Math.abs(item.value) / maxVal) * barAreaW * 0.7 : 0;

          return (
            <G key={i}>
              <SvgText x={0} y={y + barH / 2 + 4} fontSize={11} fill={colors.textSecondary}>
                {item.label}
              </SvgText>
              <Rect
                x={70} y={y + 4}
                width={Math.max(barW, 2)} height={barH - 8}
                rx={4} fill={item.color} opacity={0.8}
              />
              <SvgText
                x={70 + barW + 6} y={y + barH / 2 + 4}
                fontSize={11} fill={colors.text} fontWeight="500"
              >
                {item.value > 0 ? '+' : ''}{item.value.toFixed(1)}{unit}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    );
  };

  // ===== WEIGHT TAB =====
  const renderWeightTab = () => {
    const data = filteredWeights.map(w => convertWeight(w.weight_kg));
    const labels = filteredWeights.map(w => format(parseISO(w.date), 'M/d'));
    const goalWeight = profile?.goal_weight_kg ? convertWeight(profile.goal_weight_kg) : undefined;

    return (
      <>
        {/* Stats summary */}
        {weightStats && (
          <View style={s.statsRow}>
            <View style={[s.statBox, { borderTopColor: themeColors.primary }]}>
              <Text style={s.statValue}>{weightStats.last.toFixed(1)}</Text>
              <Text style={s.statLabel}>Current ({weightUnit})</Text>
            </View>
            <View style={[s.statBox, { borderTopColor: colors.success }]}>
              <Text style={[s.statValue, weightStats.change < 0 && s.positive]}>
                {weightStats.change > 0 ? '+' : ''}{weightStats.change.toFixed(1)}
              </Text>
              <Text style={s.statLabel}>Change ({weightUnit})</Text>
            </View>
            <View style={[s.statBox, { borderTopColor: themeColors.secondary }]}>
              <Text style={s.statValue}>{weightStats.weeklyAvg.toFixed(1)}</Text>
              <Text style={s.statLabel}>Avg/Week</Text>
            </View>
          </View>
        )}

        {/* Trend chart */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>Weight Trend</Text>
          {renderLineChart(data, labels, themeColors.chartLine, themeColors.chartFill, weightUnit, goalWeight)}
        </View>

        {/* Min/Max/Range */}
        {weightStats && (
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Weight Range</Text>
            <View style={s.rangeRow}>
              <View style={s.rangeItem}>
                <Ionicons name="arrow-down" size={16} color={colors.success} />
                <Text style={s.rangeValue}>{weightStats.min.toFixed(1)} {weightUnit}</Text>
                <Text style={s.rangeLabel}>Lowest</Text>
              </View>
              <View style={[s.rangeItem, s.rangeDivider]}>
                <Ionicons name="swap-vertical" size={16} color={themeColors.primary} />
                <Text style={s.rangeValue}>{(weightStats.max - weightStats.min).toFixed(1)} {weightUnit}</Text>
                <Text style={s.rangeLabel}>Range</Text>
              </View>
              <View style={s.rangeItem}>
                <Ionicons name="arrow-up" size={16} color={colors.error} />
                <Text style={s.rangeValue}>{weightStats.max.toFixed(1)} {weightUnit}</Text>
                <Text style={s.rangeLabel}>Highest</Text>
              </View>
            </View>
            {goalWeight && (
              <View style={s.goalRow}>
                <Ionicons name="flag" size={14} color={colors.success} />
                <Text style={s.goalText}>
                  Goal: {goalWeight.toFixed(1)} {weightUnit}
                  {weightStats.last > goalWeight
                    ? ` (${(weightStats.last - goalWeight).toFixed(1)} ${weightUnit} to go)`
                    : ' — Reached! 🎉'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Weekly breakdown */}
        {filteredWeights.length > 7 && (
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Weekly Averages</Text>
            {renderWeeklyBreakdown()}
          </View>
        )}
      </>
    );
  };

  const renderWeeklyBreakdown = () => {
    // Group weights by week
    const weeks: { weekLabel: string; avg: number }[] = [];
    let currentWeek: number[] = [];
    let currentWeekStart = '';

    filteredWeights.forEach((w, i) => {
      const dayOfWeek = new Date(w.date).getDay();
      currentWeek.push(convertWeight(w.weight_kg));
      if (currentWeekStart === '') currentWeekStart = format(parseISO(w.date), 'M/d');

      if (dayOfWeek === 0 || i === filteredWeights.length - 1) {
        const avg = currentWeek.reduce((a, b) => a + b, 0) / currentWeek.length;
        weeks.push({ weekLabel: currentWeekStart, avg });
        currentWeek = [];
        currentWeekStart = '';
      }
    });

    if (weeks.length < 2) return <Text style={s.noDataSmall}>Not enough weekly data</Text>;

    const data = weeks.map(w => w.avg);
    const labels = weeks.map(w => w.weekLabel);
    return renderLineChart(data, labels, themeColors.secondary, themeColors.secondaryLight, weightUnit);
  };

  // ===== MEASUREMENTS TAB =====
  const renderMeasurementsTab = () => {
    const measData = filteredMeas
      .filter(m => (m as any)[selectedMeasurement] != null)
      .map(m => convertMeas((m as any)[selectedMeasurement]));
    const measLabels = filteredMeas
      .filter(m => (m as any)[selectedMeasurement] != null)
      .map(m => format(parseISO(m.date), 'M/d'));

    return (
      <>
        {/* Measurement selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.measSelector}>
          {MEAS_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[
                s.measTab,
                selectedMeasurement === opt.key && { backgroundColor: themeColors.primary },
              ]}
              onPress={() => setSelectedMeasurement(opt.key)}
            >
              <Text style={[
                s.measTabText,
                selectedMeasurement === opt.key && { color: '#fff' },
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Trend chart */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>
            {MEAS_OPTIONS.find(o => o.key === selectedMeasurement)?.label} Trend
          </Text>
          {renderLineChart(measData, measLabels, themeColors.secondary, themeColors.secondaryLight, measUnit)}
        </View>

        {/* Comparison bar chart */}
        {measComparison && measComparison.length > 0 && (
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Changes Since Start</Text>
            <Text style={s.chartSubtitle}>
              {filteredMeas.length > 0 ? format(parseISO(filteredMeas[0].date), 'MMM d') : ''} → {filteredMeas.length > 0 ? format(parseISO(filteredMeas[filteredMeas.length - 1].date), 'MMM d') : ''}
            </Text>
            {renderBarChart(
              measComparison.map(m => ({
                label: m.label,
                value: m.change,
                color: m.change < 0 ? colors.success : colors.error,
              })),
              isInches ? '"' : 'cm',
            )}
            {/* Total inches lost */}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total Lost:</Text>
              <Text style={[s.totalValue, { color: colors.successDark }]}>
                {measComparison
                  .filter(m => m.change < 0)
                  .reduce((sum, m) => sum + Math.abs(m.change), 0)
                  .toFixed(1)}{isInches ? '"' : ' cm'}
              </Text>
            </View>
          </View>
        )}
      </>
    );
  };

  // ===== ZEPBOUND TAB =====
  const renderZepboundTab = () => {
    const doseData = filteredShots.map(s => s.dose_mg);
    const doseLabels = filteredShots.map(s => format(parseISO(s.date), 'M/d'));

    // Weight data overlaid with shot dates
    const weightData = filteredWeights.map(w => convertWeight(w.weight_kg));
    const weightLabels = filteredWeights.map(w => format(parseISO(w.date), 'M/d'));

    return (
      <>
        {/* Zep stats */}
        {zepStats && zepStats.totalShots > 0 && (
          <View style={s.statsRow}>
            <View style={[s.statBox, { borderTopColor: themeColors.secondary }]}>
              <Text style={s.statValue}>{zepStats.totalShots}</Text>
              <Text style={s.statLabel}>Shots</Text>
            </View>
            <View style={[s.statBox, { borderTopColor: themeColors.primary }]}>
              <Text style={s.statValue}>{zepStats.currentDose} mg</Text>
              <Text style={s.statLabel}>Current Dose</Text>
            </View>
            <View style={[s.statBox, { borderTopColor: colors.success }]}>
              <Text style={[s.statValue, s.positive]}>
                {zepStats.weightLostSinceStart > 0
                  ? `-${convertWeight(zepStats.weightLostSinceStart).toFixed(1)}`
                  : '--'}
              </Text>
              <Text style={s.statLabel}>Since Start ({weightUnit})</Text>
            </View>
          </View>
        )}

        {/* Dose timeline */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>Dose Progression</Text>
          {renderLineChart(doseData, doseLabels, themeColors.secondary, themeColors.secondaryLight, 'mg')}
        </View>

        {/* Weight since starting */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>Weight Since Starting Zepbound</Text>
          {renderLineChart(weightData, weightLabels, themeColors.chartLine, themeColors.chartFill, weightUnit)}
        </View>

        {/* Injection site breakdown */}
        {filteredShots.length > 0 && (
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Injection Sites</Text>
            {renderInjectionSites()}
          </View>
        )}
      </>
    );
  };

  const renderInjectionSites = () => {
    const sites: Record<string, number> = {};
    filteredShots.forEach(s => {
      const site = s.injection_site || 'Not recorded';
      sites[site] = (sites[site] || 0) + 1;
    });
    const entries = Object.entries(sites).sort((a, b) => b[1] - a[1]);
    const siteColors = [themeColors.primary, themeColors.secondary, themeColors.accent, colors.success, colors.warning, colors.error];
    
    return (
      <View style={s.sitesList}>
        {entries.map(([site, count], i) => (
          <View key={site} style={s.siteRow}>
            <View style={[s.siteDot, { backgroundColor: siteColors[i % siteColors.length] }]} />
            <Text style={s.siteLabel}>{site}</Text>
            <Text style={s.siteCount}>{count}x</Text>
          </View>
        ))}
      </View>
    );
  };

  // ===== BMI TAB =====
  const renderBMITab = () => {
    if (!bmiData || bmiData.length < 2) {
      return (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>BMI Tracking</Text>
          <View style={s.emptyChart}>
            <Ionicons name="body-outline" size={40} color={themeColors.primaryLight} />
            <Text style={[s.emptyChartText, { color: themeColors.textSecondary }]}>
              {!profile?.height_cm 
                ? 'Set your height in Settings to track BMI' 
                : 'Need at least 2 weight entries'}
            </Text>
          </View>
        </View>
      );
    }

    const bmiValues = bmiData.map(d => d.bmi);
    const bmiLabels = bmiData.map(d => format(parseISO(d.date), 'M/d'));
    const currentBMI = bmiValues[bmiValues.length - 1];

    const getBMICategory = (bmi: number) => {
      if (bmi < 18.5) return { label: 'Underweight', color: colors.warning };
      if (bmi < 25) return { label: 'Normal', color: colors.success };
      if (bmi < 30) return { label: 'Overweight', color: colors.warning };
      return { label: 'Obese', color: colors.error };
    };

    const category = getBMICategory(currentBMI);

    return (
      <>
        {/* Current BMI */}
        <View style={[s.bmiHero, { backgroundColor: themeColors.primary }]}>
          <Text style={s.bmiHeroLabel}>Current BMI</Text>
          <Text style={s.bmiHeroValue}>{currentBMI.toFixed(1)}</Text>
          <View style={[s.bmiCategoryBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={s.bmiCategoryText}>{category.label}</Text>
          </View>
        </View>

        {/* BMI Scale */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>BMI Scale</Text>
          <View style={s.bmiScale}>
            {[
              { label: 'Under', range: '< 18.5', color: '#FFE5B4', min: 0, max: 18.5 },
              { label: 'Normal', range: '18.5-24.9', color: '#A8E6CF', min: 18.5, max: 25 },
              { label: 'Over', range: '25-29.9', color: '#FFE5B4', min: 25, max: 30 },
              { label: 'Obese', range: '30+', color: '#FFB4B4', min: 30, max: 45 },
            ].map((cat, i) => (
              <View
                key={i}
                style={[
                  s.bmiScaleSegment,
                  { backgroundColor: cat.color, flex: cat.max - cat.min },
                  currentBMI >= cat.min && currentBMI < cat.max && s.bmiScaleActive,
                ]}
              >
                <Text style={s.bmiScaleLabel}>{cat.label}</Text>
                <Text style={s.bmiScaleRange}>{cat.range}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* BMI Trend */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>BMI Trend</Text>
          {renderLineChart(bmiValues, bmiLabels, themeColors.accent, themeColors.accentLight, '')}
        </View>
      </>
    );
  };

  const tabs: { key: ChartTab; label: string; icon: string }[] = [
    { key: 'weight', label: 'Weight', icon: 'scale-outline' },
    { key: 'measurements', label: 'Body', icon: 'body-outline' },
    { key: 'zepbound', label: 'Zepbound', icon: 'medical-outline' },
    { key: 'bmi', label: 'BMI', icon: 'analytics-outline' },
  ];

  return (
    <View style={s.container}>
      {/* Tab selector */}
      <View style={s.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && { backgroundColor: themeColors.primary }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? '#fff' : colors.textSecondary}
            />
            <Text style={[s.tabText, activeTab === tab.key && { color: '#fff' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Time range */}
      <View style={s.timeRow}>
        {(['1W', '1M', '3M', '6M', '1Y', 'ALL'] as TimeRange[]).map(range => (
          <TouchableOpacity
            key={range}
            style={[s.timeBtn, timeRange === range && { backgroundColor: themeColors.primaryLight }]}
            onPress={() => setTimeRange(range)}
          >
            <Text style={[s.timeBtnText, timeRange === range && { color: themeColors.primaryDark, fontWeight: '600' }]}>
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'weight' && renderWeightTab()}
        {activeTab === 'measurements' && renderMeasurementsTab()}
        {activeTab === 'zepbound' && renderZepboundTab()}
        {activeTab === 'bmi' && renderBMITab()}
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    gap: 4,
    ...shadows.sm,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  timeRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  timeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  timeBtnText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 3,
    ...shadows.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  positive: {
    color: '#4CAF50',
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: -4,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
  },
  emptyChartText: {
    marginTop: spacing.sm,
    fontSize: 13,
    textAlign: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
  },
  rangeItem: {
    alignItems: 'center',
    flex: 1,
  },
  rangeDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  rangeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  rangeLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  goalText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  noDataSmall: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.md,
  },
  measSelector: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  measTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: spacing.xs,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  measTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sitesList: {
    gap: spacing.sm,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  siteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  siteLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  siteCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  bmiHero: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  bmiHeroLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  bmiHeroValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginVertical: spacing.xs,
  },
  bmiCategoryBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  bmiCategoryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bmiScale: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    height: 56,
  },
  bmiScaleSegment: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bmiScaleActive: {
    borderWidth: 2,
    borderColor: '#333',
  },
  bmiScaleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },
  bmiScaleRange: {
    fontSize: 9,
    color: '#777',
  },
});
