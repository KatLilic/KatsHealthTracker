import React, { useState, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { format, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  addMeasurement,
  getMeasurements,
  deleteMeasurement,
  MeasurementEntry,
} from '../database/db';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

const screenWidth = Dimensions.get('window').width;

const MEASUREMENT_FIELDS = [
  { key: 'rib_cage_cm', label: 'Rib Cage', icon: 'body-outline' },
  { key: 'waist_cm', label: 'Waist', icon: 'fitness-outline' },
  { key: 'lower_belly_cm', label: 'Lower Belly', icon: 'ellipse-outline' },
  { key: 'hips_cm', label: 'Hips / Glutes', icon: 'ellipse-outline' },
  { key: 'left_arm_cm', label: 'Left Arm', icon: 'fitness-outline' },
  { key: 'right_arm_cm', label: 'Right Arm', icon: 'fitness-outline' },
  { key: 'left_wrist_cm', label: 'Left Wrist', icon: 'hand-left-outline' },
  { key: 'right_wrist_cm', label: 'Right Wrist', icon: 'hand-right-outline' },
  { key: 'left_thigh_cm', label: 'Left Thigh', icon: 'walk-outline' },
  { key: 'right_thigh_cm', label: 'Right Thigh', icon: 'walk-outline' },
  { key: 'left_calf_cm', label: 'Left Calf', icon: 'walk-outline' },
  { key: 'right_calf_cm', label: 'Right Calf', icon: 'walk-outline' },
] as const;

export default function MeasurementsScreen() {
  const [entries, setEntries] = useState<MeasurementEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isInches, setIsInches] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [notesInput, setNotesInput] = useState('');
  const [measurementInputs, setMeasurementInputs] = useState<Record<string, string>>({});
  const [selectedMeasurement, setSelectedMeasurement] = useState<typeof MEASUREMENT_FIELDS[number]['key']>('waist_cm');
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  const loadData = async () => {
    try {
      const measurements = await getMeasurements();
      setEntries(measurements);
    } catch (error) {
      console.error('Failed to load measurements:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleAddMeasurement = async () => {
    const hasAtLeastOne = Object.values(measurementInputs).some(v => v && parseFloat(v) > 0);
    
    if (!hasAtLeastOne) {
      Alert.alert('Error', 'Please enter at least one measurement');
      return;
    }

    try {
      const measurement: Partial<MeasurementEntry> & { date: string } = {
        date: format(selectedDate, 'yyyy-MM-dd'),
        notes: notesInput || undefined,
      };

      // Convert inputs to cm if in inches
      MEASUREMENT_FIELDS.forEach(field => {
        const value = measurementInputs[field.key];
        if (value) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && numValue > 0) {
            (measurement as any)[field.key] = isInches ? numValue * 2.54 : numValue;
          }
        }
      });

      await addMeasurement(measurement);
      Alert.alert('Saved!', 'Your measurements have been recorded.');
      setShowAddModal(false);
      setMeasurementInputs({});
      setNotesInput('');
      setSelectedDate(new Date());
      loadData();
    } catch (error) {
      console.error('Failed to add measurement:', error);
      Alert.alert('Error', 'Failed to save measurement');
    }
  };

  const handleDeleteMeasurement = (id: number) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this measurement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMeasurement(id);
              loadData();
            } catch (error) {
              console.error('Failed to delete:', error);
            }
          },
        },
      ]
    );
  };

  const formatMeasurement = (cm: number | null) => {
    if (cm === null) return '--';
    if (isInches) {
      return `${(cm / 2.54).toFixed(1)}"`;
    }
    return `${cm.toFixed(1)} cm`;
  };

  // Prepare chart data for selected measurement
  const getChartData = () => {
    const validEntries = entries
      .filter(e => (e as any)[selectedMeasurement] !== null)
      .slice(0, 10)
      .reverse();

    if (validEntries.length < 2) return null;

    return {
      labels: validEntries.map(e => format(parseISO(e.date), 'M/d')),
      data: validEntries.map(e => {
        const val = (e as any)[selectedMeasurement];
        return isInches ? val / 2.54 : val;
      }),
    };
  };

  const chartInfo = getChartData();

  const getLatestChange = () => {
    if (entries.length < 2) return null;
    
    const latest = (entries[0] as any)[selectedMeasurement];
    const previous = (entries[1] as any)[selectedMeasurement];
    
    if (latest === null || previous === null) return null;
    
    const diff = latest - previous;
    return isInches ? diff / 2.54 : diff;
  };

  const latestChange = getLatestChange();

  return (
    <View style={styles.container}>
      {/* Measurement Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.measurementSelector}>
        {MEASUREMENT_FIELDS.map(field => (
          <TouchableOpacity
            key={field.key}
            style={[
              styles.measurementTab,
              selectedMeasurement === field.key && styles.measurementTabActive,
            ]}
            onPress={() => setSelectedMeasurement(field.key)}
          >
            <Text
              style={[
                styles.measurementTabText,
                selectedMeasurement === field.key && styles.measurementTabTextActive,
              ]}
            >
              {field.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart */}
      {chartInfo && (
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>
              {MEASUREMENT_FIELDS.find(f => f.key === selectedMeasurement)?.label} Trend
            </Text>
            {latestChange !== null && (
              <Text style={[styles.changeText, latestChange < 0 ? styles.positive : styles.negative]}>
                {latestChange > 0 ? '+' : ''}{latestChange.toFixed(1)}{isInches ? '"' : ' cm'}
              </Text>
            )}
          </View>
          <LineChart
            data={{
              labels: chartInfo.labels,
              datasets: [{ data: chartInfo.data }],
            }}
            width={screenWidth - 48}
            height={160}
            yAxisSuffix={isInches ? '"' : ' cm'}
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
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {/* Unit Toggle */}
      <View style={styles.unitToggle}>
        <TouchableOpacity
          style={[styles.unitButton, isInches && styles.unitButtonActive]}
          onPress={() => setIsInches(true)}
        >
          <Text style={[styles.unitButtonText, isInches && styles.unitButtonTextActive]}>inches</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitButton, !isInches && styles.unitButtonActive]}
          onPress={() => setIsInches(false)}
        >
          <Text style={[styles.unitButtonText, !isInches && styles.unitButtonTextActive]}>cm</Text>
        </TouchableOpacity>
      </View>

      {/* Entries List */}
      <ScrollView style={styles.listContainer}>
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="body-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No measurements yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add your first measurement</Text>
          </View>
        ) : (
          entries.map(entry => (
            <TouchableOpacity
              key={entry.id}
              style={styles.entryItem}
              onPress={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
            >
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>{format(parseISO(entry.date), 'MMM d, yyyy')}</Text>
                <View style={styles.entryActions}>
                  <Ionicons
                    name={expandedEntry === entry.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#999"
                  />
                  <TouchableOpacity
                    onPress={() => handleDeleteMeasurement(entry.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {expandedEntry === entry.id && (
                <View style={styles.entryDetails}>
                  {MEASUREMENT_FIELDS.map(field => (
                    <View key={field.key} style={styles.measurementRow}>
                      <Text style={styles.measurementLabel}>{field.label}</Text>
                      <Text style={styles.measurementValue}>
                        {formatMeasurement((entry as any)[field.key])}
                      </Text>
                    </View>
                  ))}
                  {entry.notes && (
                    <Text style={styles.entryNotes}>{entry.notes}</Text>
                  )}
                </View>
              )}

              {expandedEntry !== entry.id && (
                <View style={styles.entrySummary}>
                  <Text style={styles.summaryText}>
                    Waist: {formatMeasurement(entry.waist_cm)} • Hips: {formatMeasurement(entry.hips_cm)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
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
              <Text style={styles.modalTitle}>Add Measurements</Text>

              <Text style={styles.dateLabel}>Date</Text>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={(event, date) => date && setSelectedDate(date)}
                style={styles.datePicker}
                maximumDate={new Date()}
              />

              <Text style={styles.sectionLabel}>
                Body Measurements ({isInches ? 'inches' : 'cm'})
              </Text>

              {MEASUREMENT_FIELDS.map(field => (
                <View key={field.key} style={styles.measurementInputRow}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.measurementInput}
                    value={measurementInputs[field.key] || ''}
                    onChangeText={text =>
                      setMeasurementInputs(prev => ({ ...prev, [field.key]: text }))
                    }
                    placeholder="--"
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}

              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notesInput}
                onChangeText={setNotesInput}
                placeholder="Notes (optional)"
                multiline
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleAddMeasurement}>
                  <Text style={styles.saveButtonText}>Save</Text>
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
  measurementSelector: {
    maxHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  measurementTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  measurementTabActive: {
    backgroundColor: '#9B59B6',
  },
  measurementTabText: {
    color: '#666',
    fontWeight: '500',
  },
  measurementTabTextActive: {
    color: '#fff',
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 16,
    padding: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#FF6B6B',
  },
  chart: {
    borderRadius: 16,
    marginLeft: -8,
  },
  unitToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  unitButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  unitButtonActive: {
    backgroundColor: '#9B59B6',
  },
  unitButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  entryItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    marginLeft: 12,
  },
  entrySummary: {
    marginTop: 8,
  },
  summaryText: {
    color: '#666',
    fontSize: 14,
  },
  entryDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  measurementLabel: {
    color: '#666',
  },
  measurementValue: {
    fontWeight: '600',
    color: '#333',
  },
  entryNotes: {
    marginTop: 8,
    fontStyle: 'italic',
    color: '#999',
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  measurementInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
  },
  measurementInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    width: 80,
    textAlign: 'center',
    fontSize: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  datePicker: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
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
