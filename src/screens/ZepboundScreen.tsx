import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { format, parseISO, differenceInDays, differenceInWeeks } from 'date-fns';
import {
  addZepboundShot,
  getZepboundShots,
  deleteZepboundShot,
  getZepboundStats,
  getWeightEntriesForChart,
  ZepboundEntry,
} from '../database/db';

const screenWidth = Dimensions.get('window').width;

const DOSE_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15];
const INJECTION_SITES = ['Left Thigh', 'Right Thigh', 'Left Abdomen', 'Right Abdomen', 'Left Arm', 'Right Arm'];

interface ZepboundStats {
  totalShots: number;
  firstShotDate: string | null;
  latestShotDate: string | null;
  currentDose: number | null;
  weightLostSinceStart: number;
  daysOnTreatment: number;
  weeksOnTreatment: number;
}

export default function ZepboundScreen() {
  const [shots, setShots] = useState<ZepboundEntry[]>([]);
  const [stats, setStats] = useState<ZepboundStats | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDose, setSelectedDose] = useState<number>(2.5);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [sideEffectsInput, setSideEffectsInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [doseChartData, setDoseChartData] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
  const [weightChartData, setWeightChartData] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });

  const loadData = async () => {
    try {
      const shotEntries = await getZepboundShots();
      setShots(shotEntries);

      const statsData = await getZepboundStats();
      
      let daysOnTreatment = 0;
      let weeksOnTreatment = 0;
      if (statsData.firstShotDate) {
        daysOnTreatment = differenceInDays(new Date(), parseISO(statsData.firstShotDate));
        weeksOnTreatment = differenceInWeeks(new Date(), parseISO(statsData.firstShotDate));
      }

      setStats({
        ...statsData,
        daysOnTreatment,
        weeksOnTreatment,
      });

      // Prepare dose chart data
      if (shotEntries.length > 0) {
        const chartShots = shotEntries.slice(0, 12).reverse();
        setDoseChartData({
          labels: chartShots.map(s => format(parseISO(s.date), 'M/d')),
          data: chartShots.map(s => s.dose_mg),
        });
      }

      // Get weight data since first shot
      if (statsData.firstShotDate) {
        const days = differenceInDays(new Date(), parseISO(statsData.firstShotDate));
        const weights = await getWeightEntriesForChart(days + 7);
        if (weights.length > 1) {
          const filteredWeights = weights.filter((_, i) => 
            i % Math.ceil(weights.length / 10) === 0 || i === weights.length - 1
          );
          setWeightChartData({
            labels: filteredWeights.map(w => format(parseISO(w.date), 'M/d')),
            data: filteredWeights.map(w => w.weight_kg * 2.205), // Convert to lbs
          });
        }
      }
    } catch (error) {
      console.error('Failed to load Zepbound data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleAddShot = async () => {
    try {
      await addZepboundShot(
        format(selectedDate, 'yyyy-MM-dd'),
        selectedDose,
        selectedSite || undefined,
        sideEffectsInput || undefined,
        notesInput || undefined
      );
      setShowAddModal(false);
      setSelectedDate(new Date());
      setSelectedDose(stats?.currentDose || 2.5);
      setSelectedSite('');
      setSideEffectsInput('');
      setNotesInput('');
      loadData();
    } catch (error) {
      console.error('Failed to add shot:', error);
      Alert.alert('Error', 'Failed to save shot entry');
    }
  };

  const handleDeleteShot = (id: number) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this shot entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteZepboundShot(id);
              loadData();
            } catch (error) {
              console.error('Failed to delete:', error);
            }
          },
        },
      ]
    );
  };

  const getNextShotDate = () => {
    if (!stats?.latestShotDate) return null;
    const lastShot = parseISO(stats.latestShotDate);
    const nextShot = new Date(lastShot);
    nextShot.setDate(nextShot.getDate() + 7);
    return nextShot;
  };

  const getDaysUntilNextShot = () => {
    const nextShot = getNextShotDate();
    if (!nextShot) return null;
    const days = differenceInDays(nextShot, new Date());
    return days;
  };

  const nextShotDate = getNextShotDate();
  const daysUntilNext = getDaysUntilNextShot();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stats Cards */}
        {stats && stats.totalShots > 0 && (
          <>
            {/* Next Shot Alert */}
            {nextShotDate && (
              <View style={[
                styles.nextShotCard,
                daysUntilNext !== null && daysUntilNext <= 0 && styles.nextShotDue,
              ]}>
                <Ionicons 
                  name={daysUntilNext !== null && daysUntilNext <= 0 ? 'alert-circle' : 'calendar'} 
                  size={32} 
                  color={daysUntilNext !== null && daysUntilNext <= 0 ? '#FF6B6B' : '#4A90D9'} 
                />
                <View style={styles.nextShotInfo}>
                  <Text style={styles.nextShotLabel}>
                    {daysUntilNext !== null && daysUntilNext <= 0 ? 'Shot Due!' : 'Next Shot'}
                  </Text>
                  <Text style={styles.nextShotDate}>
                    {format(nextShotDate, 'EEEE, MMM d')}
                  </Text>
                  {daysUntilNext !== null && daysUntilNext > 0 && (
                    <Text style={styles.nextShotDays}>
                      {daysUntilNext} day{daysUntilNext !== 1 ? 's' : ''} away
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.logShotButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Text style={styles.logShotText}>Log Shot</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Progress Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalShots}</Text>
                <Text style={styles.statLabel}>Total Shots</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.weeksOnTreatment}</Text>
                <Text style={styles.statLabel}>Weeks</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.currentDose} mg</Text>
                <Text style={styles.statLabel}>Current Dose</Text>
              </View>
              <View style={[styles.statCard, styles.weightLossCard]}>
                <Text style={[styles.statValue, styles.weightLossValue]}>
                  {stats.weightLostSinceStart > 0 
                    ? `-${(stats.weightLostSinceStart * 2.205).toFixed(1)}`
                    : '--'} lbs
                </Text>
                <Text style={styles.statLabel}>Since Start</Text>
              </View>
            </View>

            {/* Weight Progress Chart */}
            {weightChartData.data.length > 1 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Weight Progress Since Starting</Text>
                <LineChart
                  data={{
                    labels: weightChartData.labels,
                    datasets: [{ data: weightChartData.data }],
                  }}
                  width={screenWidth - 48}
                  height={180}
                  yAxisSuffix=" lb"
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: '4', strokeWidth: '1', stroke: '#4CAF50' },
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>
            )}

            {/* Dose History Chart */}
            {doseChartData.data.length > 1 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Dose Progression</Text>
                <LineChart
                  data={{
                    labels: doseChartData.labels.filter((_, i) => 
                      i % Math.ceil(doseChartData.labels.length / 5) === 0 || i === doseChartData.labels.length - 1
                    ),
                    datasets: [{ data: doseChartData.data }],
                  }}
                  width={screenWidth - 48}
                  height={150}
                  yAxisSuffix=" mg"
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(156, 89, 182, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: '4', strokeWidth: '1', stroke: '#9B59B6' },
                  }}
                  style={styles.chart}
                />
              </View>
            )}

            {/* Journey Stats */}
            {stats.firstShotDate && (
              <View style={styles.journeyCard}>
                <Text style={styles.journeyTitle}>Your Zepbound Journey</Text>
                <View style={styles.journeyRow}>
                  <Ionicons name="flag-outline" size={20} color="#4A90D9" />
                  <Text style={styles.journeyText}>
                    Started: {format(parseISO(stats.firstShotDate), 'MMMM d, yyyy')}
                  </Text>
                </View>
                <View style={styles.journeyRow}>
                  <Ionicons name="time-outline" size={20} color="#4A90D9" />
                  <Text style={styles.journeyText}>
                    {stats.daysOnTreatment} days on treatment
                  </Text>
                </View>
                {stats.weightLostSinceStart > 0 && (
                  <View style={styles.journeyRow}>
                    <Ionicons name="trending-down-outline" size={20} color="#4CAF50" />
                    <Text style={styles.journeyText}>
                      Lost {(stats.weightLostSinceStart * 2.205).toFixed(1)} lbs 
                      ({((stats.weightLostSinceStart * 2.205) / (stats.weeksOnTreatment || 1)).toFixed(1)} lbs/week avg)
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Clinical Study Comparison */}
            {stats.currentDose && stats.weeksOnTreatment > 0 && (
              <View style={styles.studyCard}>
                <View style={styles.studyHeader}>
                  <Ionicons name="flask-outline" size={22} color="#9B59B6" />
                  <Text style={styles.studyTitle}>Clinical Study Comparison</Text>
                </View>
                <Text style={styles.studySubtitle}>
                  Based on SURMOUNT-1 trial results (72 weeks)
                </Text>
                
                {/* Expected Loss by Dose */}
                <View style={styles.doseExpected}>
                  <Text style={styles.doseExpectedTitle}>
                    Expected Weight Loss at {stats.currentDose}mg:
                  </Text>
                  <View style={styles.studyStats}>
                    <View style={styles.studyStat}>
                      <Text style={styles.studyStatValue}>
                        {stats.currentDose <= 5 ? '15%' : stats.currentDose <= 10 ? '19.5%' : '20.9%'}
                      </Text>
                      <Text style={styles.studyStatLabel}>Avg. Body Weight Loss</Text>
                    </View>
                    <View style={styles.studyStat}>
                      <Text style={styles.studyStatValue}>
                        {stats.currentDose <= 5 ? '85%' : stats.currentDose <= 10 ? '89%' : '91%'}
                      </Text>
                      <Text style={styles.studyStatLabel}>Achieved ≥5% Loss</Text>
                    </View>
                  </View>
                </View>

                {/* Your Progress vs Study */}
                {stats.weightLostSinceStart > 0 && weightChartData.data.length > 0 && (
                  <View style={styles.progressComparison}>
                    <Text style={styles.comparisonTitle}>Your Progress</Text>
                    {(() => {
                      const startWeight = weightChartData.data[0];
                      const currentWeight = weightChartData.data[weightChartData.data.length - 1];
                      const lostLbs = stats.weightLostSinceStart * 2.205;
                      const percentLost = (lostLbs / startWeight) * 100;
                      const expectedWeekly = stats.currentDose <= 5 ? 0.8 : stats.currentDose <= 10 ? 1.2 : 1.5;
                      const expectedByNow = expectedWeekly * stats.weeksOnTreatment;
                      const isAhead = lostLbs >= expectedByNow;
                      
                      return (
                        <>
                          <View style={styles.comparisonRow}>
                            <View style={styles.comparisonItem}>
                              <Text style={styles.comparisonValue}>{percentLost.toFixed(1)}%</Text>
                              <Text style={styles.comparisonLabel}>Your % Lost</Text>
                            </View>
                            <View style={styles.comparisonDivider} />
                            <View style={styles.comparisonItem}>
                              <Text style={styles.comparisonValue}>{lostLbs.toFixed(1)} lbs</Text>
                              <Text style={styles.comparisonLabel}>Total Lost</Text>
                            </View>
                          </View>
                          <View style={[
                            styles.progressNote,
                            { backgroundColor: isAhead ? '#E8F5E9' : '#FFF3E0' }
                          ]}>
                            <Ionicons 
                              name={isAhead ? 'checkmark-circle' : 'information-circle'} 
                              size={18} 
                              color={isAhead ? '#4CAF50' : '#FF9800'} 
                            />
                            <Text style={[
                              styles.progressNoteText,
                              { color: isAhead ? '#2E7D32' : '#E65100' }
                            ]}>
                              {isAhead 
                                ? `You're ahead! Expected ~${expectedByNow.toFixed(1)} lbs by week ${stats.weeksOnTreatment}`
                                : `Typical loss is ~${expectedWeekly} lbs/week. Stay consistent!`
                              }
                            </Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                )}

                {/* Dose Schedule Info */}
                <View style={styles.doseInfo}>
                  <Text style={styles.doseInfoTitle}>📋 Standard Dose Schedule:</Text>
                  <Text style={styles.doseInfoText}>
                    • 2.5mg: Weeks 1-4 (starting dose){'\n'}
                    • 5mg: Weeks 5-8{'\n'}
                    • 7.5mg: Weeks 9-12{'\n'}
                    • 10mg: Weeks 13-16{'\n'}
                    • 12.5mg: Weeks 17-20{'\n'}
                    • 15mg: Week 21+ (max maintenance)
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Shot History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Shot History</Text>
          {shots.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="medical-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No shots logged yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to log your first Zepbound shot
              </Text>
            </View>
          ) : (
            shots.map((shot, index) => (
              <View key={shot.id} style={styles.shotItem}>
                <View style={styles.shotHeader}>
                  <View style={styles.shotNumber}>
                    <Text style={styles.shotNumberText}>#{shots.length - index}</Text>
                  </View>
                  <View style={styles.shotMainInfo}>
                    <Text style={styles.shotDate}>
                      {format(parseISO(shot.date), 'MMM d, yyyy')}
                    </Text>
                    <Text style={styles.shotDose}>{shot.dose_mg} mg</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteShot(shot.id)}>
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
                {(shot.injection_site || shot.side_effects || shot.notes) && (
                  <View style={styles.shotDetails}>
                    {shot.injection_site && (
                      <Text style={styles.shotDetailText}>
                        <Ionicons name="location-outline" size={12} /> {shot.injection_site}
                      </Text>
                    )}
                    {shot.side_effects && (
                      <Text style={styles.shotDetailText}>
                        <Ionicons name="warning-outline" size={12} /> {shot.side_effects}
                      </Text>
                    )}
                    {shot.notes && (
                      <Text style={styles.shotNotes}>{shot.notes}</Text>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          setSelectedDose(stats?.currentDose || 2.5);
          setShowAddModal(true);
        }}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Log Zepbound Shot</Text>

              <Text style={styles.inputLabel}>Date</Text>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={(event, date) => date && setSelectedDate(date)}
                style={styles.datePicker}
                maximumDate={new Date()}
              />

              <Text style={styles.inputLabel}>Dose (mg)</Text>
              <View style={styles.doseGrid}>
                {DOSE_OPTIONS.map(dose => (
                  <TouchableOpacity
                    key={dose}
                    style={[
                      styles.doseButton,
                      selectedDose === dose && styles.doseButtonActive,
                    ]}
                    onPress={() => setSelectedDose(dose)}
                  >
                    <Text style={[
                      styles.doseButtonText,
                      selectedDose === dose && styles.doseButtonTextActive,
                    ]}>
                      {dose} mg
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Injection Site (optional)</Text>
              <View style={styles.siteGrid}>
                {INJECTION_SITES.map(site => (
                  <TouchableOpacity
                    key={site}
                    style={[
                      styles.siteButton,
                      selectedSite === site && styles.siteButtonActive,
                    ]}
                    onPress={() => setSelectedSite(selectedSite === site ? '' : site)}
                  >
                    <Text style={[
                      styles.siteButtonText,
                      selectedSite === site && styles.siteButtonTextActive,
                    ]}>
                      {site}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Side Effects (optional)</Text>
              <TextInput
                style={styles.input}
                value={sideEffectsInput}
                onChangeText={setSideEffectsInput}
                placeholder="e.g., Nausea, fatigue..."
              />

              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notesInput}
                onChangeText={setNotesInput}
                placeholder="Any additional notes..."
                multiline
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleAddShot}>
                  <Text style={styles.saveButtonText}>Save Shot</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  nextShotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  nextShotDue: {
    backgroundColor: '#FFEBEE',
  },
  nextShotInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nextShotLabel: {
    fontSize: 12,
    color: '#666',
  },
  nextShotDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  nextShotDays: {
    fontSize: 12,
    color: '#4A90D9',
    marginTop: 2,
  },
  logShotButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logShotText: {
    color: '#fff',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  weightLossCard: {
    backgroundColor: '#E8F5E9',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  weightLossValue: {
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  journeyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  journeyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  journeyText: {
    marginLeft: 8,
    color: '#666',
  },
  // Clinical Study Styles
  studyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E0F0',
  },
  studyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  studyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333',
  },
  studySubtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
    marginLeft: 30,
  },
  doseExpected: {
    backgroundColor: '#F5F0FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  doseExpectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B4C9A',
    marginBottom: 8,
  },
  studyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  studyStat: {
    alignItems: 'center',
  },
  studyStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#9B59B6',
  },
  studyStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  progressComparison: {
    marginBottom: 12,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  comparisonItem: {
    alignItems: 'center',
    flex: 1,
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
  },
  comparisonLabel: {
    fontSize: 11,
    color: '#666',
  },
  comparisonDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  progressNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  progressNoteText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
  },
  doseInfo: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
  },
  doseInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  doseInfoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 20,
  },
  historySection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  shotItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
  },
  shotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shotNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F4FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shotNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A90D9',
  },
  shotMainInfo: {
    flex: 1,
  },
  shotDate: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  shotDose: {
    fontSize: 14,
    color: '#9B59B6',
    fontWeight: '600',
  },
  shotDetails: {
    marginLeft: 44,
    marginTop: 8,
  },
  shotDetailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  shotNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
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
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#9B59B6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  datePicker: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  doseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  doseButton: {
    width: '31%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    marginBottom: 8,
  },
  doseButtonActive: {
    backgroundColor: '#9B59B6',
  },
  doseButtonText: {
    fontWeight: '600',
    color: '#666',
  },
  doseButtonTextActive: {
    color: '#fff',
  },
  siteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  siteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
  },
  siteButtonActive: {
    backgroundColor: '#4A90D9',
  },
  siteButtonText: {
    fontSize: 12,
    color: '#666',
  },
  siteButtonTextActive: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingBottom: 24,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    marginLeft: 8,
    borderRadius: 12,
    backgroundColor: '#9B59B6',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
