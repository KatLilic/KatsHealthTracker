import React, { useState, useCallback } from 'react';
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
import { LineChart } from 'react-native-chart-kit';
import { format, parseISO, differenceInDays, subMonths } from 'date-fns';
import {
  getWeightEntries,
  getMeasurements,
  getZepboundStats,
  WeightEntry,
  MeasurementEntry,
} from '../database/db';

const screenWidth = Dimensions.get('window').width;

type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface ProgressData {
  startWeight: number | null;
  currentWeight: number | null;
  lowestWeight: number | null;
  totalLost: number;
  startDate: string | null;
  daysTracking: number;
  avgLossPerWeek: number;
  startMeasurements: MeasurementEntry | null;
  currentMeasurements: MeasurementEntry | null;
}

export default function ProgressScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [weightChartData, setWeightChartData] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
  const [zepboundStats, setZepboundStats] = useState<any>(null);

  const loadData = async () => {
    try {
      const weights = await getWeightEntries();
      const measurements = await getMeasurements();
      const zepStats = await getZepboundStats();
      setZepboundStats(zepStats);

      if (weights.length === 0) {
        setProgressData(null);
        return;
      }

      // Filter weights by time range
      const now = new Date();
      let cutoffDate: Date;
      switch (timeRange) {
        case '1M': cutoffDate = subMonths(now, 1); break;
        case '3M': cutoffDate = subMonths(now, 3); break;
        case '6M': cutoffDate = subMonths(now, 6); break;
        case '1Y': cutoffDate = subMonths(now, 12); break;
        default: cutoffDate = new Date(0); // ALL
      }

      const filteredWeights = weights.filter(w => parseISO(w.date) >= cutoffDate);
      const currentWeight = weights[0]?.weight_kg || null;
      const startWeight = filteredWeights.length > 0 
        ? filteredWeights[filteredWeights.length - 1].weight_kg 
        : null;
      const lowestWeight = filteredWeights.length > 0
        ? Math.min(...filteredWeights.map(w => w.weight_kg))
        : null;

      const startDate = filteredWeights.length > 0 
        ? filteredWeights[filteredWeights.length - 1].date 
        : null;

      const daysTracking = startDate 
        ? differenceInDays(now, parseISO(startDate))
        : 0;

      const totalLost = startWeight && currentWeight 
        ? startWeight - currentWeight 
        : 0;

      const weeksTracking = daysTracking / 7;
      const avgLossPerWeek = weeksTracking > 0 ? totalLost / weeksTracking : 0;

      setProgressData({
        startWeight,
        currentWeight,
        lowestWeight,
        totalLost,
        startDate,
        daysTracking,
        avgLossPerWeek,
        startMeasurements: measurements.length > 0 ? measurements[measurements.length - 1] : null,
        currentMeasurements: measurements.length > 0 ? measurements[0] : null,
      });

      // Prepare chart data
      const chartWeights = filteredWeights.slice().reverse();
      const sampledWeights = chartWeights.filter((_, i) => 
        i % Math.ceil(chartWeights.length / 12) === 0 || i === chartWeights.length - 1
      );
      
      setWeightChartData({
        labels: sampledWeights.map(w => format(parseISO(w.date), 'M/d')),
        data: sampledWeights.map(w => w.weight_kg * 2.205), // lbs
      });
    } catch (error) {
      console.error('Failed to load progress data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [timeRange])
  );

  const formatWeight = (kg: number | null) => {
    if (kg === null) return '--';
    return `${(kg * 2.205).toFixed(1)} lbs`;
  };

  const getMeasurementChange = (key: string) => {
    if (!progressData?.currentMeasurements || !progressData?.startMeasurements) return null;
    const current = (progressData.currentMeasurements as any)[key];
    const start = (progressData.startMeasurements as any)[key];
    if (current === null || start === null) return null;
    return ((start - current) / 2.54); // Convert to inches lost
  };

  const measurementKeys = [
    { key: 'chest_cm', label: 'Chest' },
    { key: 'waist_cm', label: 'Waist' },
    { key: 'hips_cm', label: 'Hips' },
    { key: 'left_arm_cm', label: 'Arms' },
    { key: 'left_thigh_cm', label: 'Thighs' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map(range => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              timeRange === range && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange(range)}
          >
            <Text style={[
              styles.timeRangeText,
              timeRange === range && styles.timeRangeTextActive,
            ]}>
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {progressData ? (
        <>
          {/* Main Progress Card */}
          <View style={styles.mainCard}>
            <View style={styles.progressCircle}>
              <Text style={styles.progressValue}>
                {progressData.totalLost > 0 ? `-${(progressData.totalLost * 2.205).toFixed(1)}` : '0'}
              </Text>
              <Text style={styles.progressUnit}>lbs</Text>
            </View>
            <Text style={styles.progressLabel}>Total Weight Lost</Text>
            <Text style={styles.progressSubtext}>
              in {progressData.daysTracking} days ({(progressData.daysTracking / 7).toFixed(1)} weeks)
            </Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Started At</Text>
              <Text style={styles.statValue}>{formatWeight(progressData.startWeight)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Current</Text>
              <Text style={styles.statValue}>{formatWeight(progressData.currentWeight)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Lowest</Text>
              <Text style={[styles.statValue, styles.positive]}>{formatWeight(progressData.lowestWeight)}</Text>
            </View>
          </View>

          {/* Weekly Average */}
          <View style={styles.avgCard}>
            <Ionicons name="trending-down" size={24} color="#4CAF50" />
            <View style={styles.avgInfo}>
              <Text style={styles.avgValue}>
                {progressData.avgLossPerWeek > 0 
                  ? `${(progressData.avgLossPerWeek * 2.205).toFixed(2)} lbs/week`
                  : '-- lbs/week'}
              </Text>
              <Text style={styles.avgLabel}>Average Weekly Loss</Text>
            </View>
          </View>

          {/* Weight Chart */}
          {weightChartData.data.length > 1 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Weight Over Time</Text>
              <LineChart
                data={{
                  labels: weightChartData.labels,
                  datasets: [{ data: weightChartData.data }],
                }}
                width={screenWidth - 48}
                height={200}
                yAxisSuffix=" lb"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(74, 144, 217, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#4A90D9' },
                  fillShadowGradient: '#4A90D9',
                  fillShadowGradientOpacity: 0.1,
                }}
                bezier
                style={styles.chart}
                withShadow={false}
              />
            </View>
          )}

          {/* Measurement Changes */}
          {progressData.currentMeasurements && progressData.startMeasurements && (
            <View style={styles.measurementCard}>
              <Text style={styles.cardTitle}>Inches Lost</Text>
              <View style={styles.measurementGrid}>
                {measurementKeys.map(({ key, label }) => {
                  const change = getMeasurementChange(key);
                  return (
                    <View key={key} style={styles.measurementItem}>
                      <Text style={styles.measurementLabel}>{label}</Text>
                      <Text style={[
                        styles.measurementValue,
                        change && change > 0 ? styles.positive : styles.neutral,
                      ]}>
                        {change !== null ? `${change > 0 ? '-' : '+'}${Math.abs(change).toFixed(1)}"` : '--'}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {/* Total Inches */}
              <View style={styles.totalInches}>
                <Text style={styles.totalLabel}>Total Inches Lost:</Text>
                <Text style={styles.totalValue}>
                  {measurementKeys.reduce((sum, { key }) => {
                    const change = getMeasurementChange(key);
                    return sum + (change && change > 0 ? change : 0);
                  }, 0).toFixed(1)}"
                </Text>
              </View>
            </View>
          )}

          {/* Zepbound Progress */}
          {zepboundStats && zepboundStats.totalShots > 0 && (
            <View style={styles.zepboundCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="medical" size={20} color="#9B59B6" />
                <Text style={styles.cardTitle}>Zepbound Progress</Text>
              </View>
              <View style={styles.zepboundStats}>
                <View style={styles.zepboundStat}>
                  <Text style={styles.zepboundValue}>{zepboundStats.totalShots}</Text>
                  <Text style={styles.zepboundLabel}>Shots</Text>
                </View>
                <View style={styles.zepboundStat}>
                  <Text style={styles.zepboundValue}>{zepboundStats.currentDose} mg</Text>
                  <Text style={styles.zepboundLabel}>Current Dose</Text>
                </View>
                <View style={styles.zepboundStat}>
                  <Text style={[styles.zepboundValue, styles.positive]}>
                    {zepboundStats.weightLostSinceStart > 0
                      ? `-${(zepboundStats.weightLostSinceStart * 2.205).toFixed(1)}`
                      : '--'} lbs
                  </Text>
                  <Text style={styles.zepboundLabel}>Since Starting</Text>
                </View>
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No data to show</Text>
          <Text style={styles.emptySubtext}>
            Start logging your weight to see progress
          </Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timeRangeButtonActive: {
    backgroundColor: '#4A90D9',
  },
  timeRangeText: {
    color: '#666',
    fontWeight: '500',
  },
  timeRangeTextActive: {
    color: '#fff',
  },
  mainCard: {
    backgroundColor: '#4A90D9',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  progressValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  progressLabel: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  progressSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  positive: {
    color: '#4CAF50',
  },
  neutral: {
    color: '#333',
  },
  avgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  avgInfo: {
    marginLeft: 12,
  },
  avgValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  avgLabel: {
    fontSize: 12,
    color: '#666',
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  chart: {
    borderRadius: 16,
    marginLeft: -8,
  },
  measurementCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  measurementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  measurementItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 12,
  },
  measurementLabel: {
    fontSize: 12,
    color: '#666',
  },
  measurementValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  totalInches: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  zepboundCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  zepboundStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  zepboundStat: {
    alignItems: 'center',
  },
  zepboundValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#9B59B6',
  },
  zepboundLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
