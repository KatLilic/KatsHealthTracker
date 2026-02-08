import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { format, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  addWeightEntry,
  getWeightEntries,
  deleteWeightEntry,
  getWeightEntriesForChart,
  WeightEntry,
  upsertDailyNutrition,
} from '../database/db';

const screenWidth = Dimensions.get('window').width;

export default function WeightScreen() {
  const route = useRoute<any>();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProteinModal, setShowProteinModal] = useState(false);

  // Auto-open modal if navigated from quick log button
  useEffect(() => {
    if (route.params?.openModal) {
      setShowAddModal(true);
    }
    if (route.params?.openProteinModal) {
      setShowProteinModal(true);
    }
  }, [route.params?.openModal, route.params?.openProteinModal]);
  const [isLbs, setIsLbs] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [chartRange, setChartRange] = useState<7 | 30 | 90 | 365>(30);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [proteinInput, setProteinInput] = useState('');

  const loadData = async () => {
    try {
      const weightEntries = await getWeightEntries();
      setEntries(weightEntries);

      const chartEntries = await getWeightEntriesForChart(chartRange);
      if (chartEntries.length > 0) {
        setChartData(chartEntries.map(e => e.weight_kg));
        setChartLabels(chartEntries.map(e => format(parseISO(e.date), 'M/d')));
      }
    } catch (error) {
      console.error('Failed to load weight data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, [chartRange])
  );

  const handleAddWeight = async () => {
    if (!weightInput) {
      Alert.alert('Error', 'Please enter a weight');
      return;
    }

    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Error', 'Please enter a valid weight');
      return;
    }

    // Convert lbs to kg if needed
    const weightKg = isLbs ? weight / 2.205 : weight;
    
    // Parse protein input
    const proteinG = proteinInput ? parseFloat(proteinInput) : undefined;

    try {
      await addWeightEntry(weightKg, format(selectedDate, 'yyyy-MM-dd'), notesInput || undefined, proteinG);
      setShowAddModal(false);
      setWeightInput('');
      setNotesInput('');
      setProteinInput('');
      setSelectedDate(new Date());
      loadData();
    } catch (error) {
      console.error('Failed to add weight:', error);
      Alert.alert('Error', 'Failed to save weight entry');
    }
  };

  const handleAddProtein = async () => {
    if (!proteinInput) {
      Alert.alert('Error', 'Please enter protein amount');
      return;
    }

    const protein = parseFloat(proteinInput);
    if (isNaN(protein) || protein <= 0) {
      Alert.alert('Error', 'Please enter a valid protein amount');
      return;
    }

    try {
      await upsertDailyNutrition(format(selectedDate, 'yyyy-MM-dd'), protein);
      setShowProteinModal(false);
      setProteinInput('');
      setSelectedDate(new Date());
      Alert.alert('Success', `Logged ${protein}g protein for ${format(selectedDate, 'MMM d, yyyy')}`);
    } catch (error) {
      console.error('Failed to add protein:', error);
      Alert.alert('Error', 'Failed to save protein entry');
    }
  };

  const handleDeleteWeight = (id: number) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this weight entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWeightEntry(id);
              loadData();
            } catch (error) {
              console.error('Failed to delete:', error);
            }
          },
        },
      ]
    );
  };

  const formatWeight = (kg: number) => {
    if (isLbs) {
      return `${(kg * 2.205).toFixed(1)} lbs`;
    }
    return `${kg.toFixed(1)} kg`;
  };

  const renderEntry = ({ item }: { item: WeightEntry }) => (
    <View style={styles.entryItem}>
      <View style={styles.entryInfo}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryWeight}>{formatWeight(item.weight_kg)}</Text>
          {item.protein_g && (
            <View style={styles.proteinBadge}>
              <Ionicons name="nutrition" size={12} color="#4A90D9" />
              <Text style={styles.proteinText}>{item.protein_g}g protein</Text>
            </View>
          )}
        </View>
        <Text style={styles.entryDate}>{format(parseISO(item.date), 'MMM d, yyyy')}</Text>
        {item.notes && <Text style={styles.entryNotes}>{item.notes}</Text>}
      </View>
      <TouchableOpacity onPress={() => handleDeleteWeight(item.id)}>
        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Chart Section */}
      {chartData.length > 1 && (
        <View style={styles.chartContainer}>
          <View style={styles.chartRangeSelector}>
            {([7, 30, 90, 365] as const).map(range => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.rangeButton,
                  chartRange === range && styles.rangeButtonActive,
                ]}
                onPress={() => setChartRange(range)}
              >
                <Text
                  style={[
                    styles.rangeButtonText,
                    chartRange === range && styles.rangeButtonTextActive,
                  ]}
                >
                  {range === 365 ? '1Y' : `${range}D`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <LineChart
            data={{
              labels: chartLabels.filter((_, i) => i % Math.ceil(chartLabels.length / 6) === 0 || i === chartLabels.length - 1),
              datasets: [{ data: chartData }],
            }}
            width={screenWidth - 32}
            height={180}
            yAxisSuffix={isLbs ? ' lb' : ' kg'}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(74, 144, 217, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: '4', strokeWidth: '1', stroke: '#4A90D9' },
            }}
            bezier
            style={styles.chart}
            fromZero={false}
          />
        </View>
      )}

      {/* Unit Toggle */}
      <View style={styles.unitToggle}>
        <TouchableOpacity
          style={[styles.unitButton, isLbs && styles.unitButtonActive]}
          onPress={() => setIsLbs(true)}
        >
          <Text style={[styles.unitButtonText, isLbs && styles.unitButtonTextActive]}>lbs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitButton, !isLbs && styles.unitButtonActive]}
          onPress={() => setIsLbs(false)}
        >
          <Text style={[styles.unitButtonText, !isLbs && styles.unitButtonTextActive]}>kg</Text>
        </TouchableOpacity>
      </View>

      {/* Entries List */}
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="scale-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No weight entries yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add your first entry</Text>
          </View>
        }
      />

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
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <Text style={styles.modalTitle}>Log Weight</Text>

            {/* Weight Input */}
            <View style={{ backgroundColor: '#f0f0f0', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <Text style={[styles.inputLabel, { marginBottom: 8 }]}>Weight</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.weightInput, { marginBottom: 0 }]}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder="Enter weight"
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <Text style={styles.unitLabel}>{isLbs ? 'lbs' : 'kg'}</Text>
              </View>
            </View>

            {/* Date */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.inputLabel, { marginBottom: 0, marginRight: 12 }]}>Date:</Text>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="compact"
                onChange={(event, date) => date && setSelectedDate(date)}
                maximumDate={new Date()}
              />
            </View>

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
              <TouchableOpacity style={styles.saveButton} onPress={handleAddWeight}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Protein Only Modal */}
      <Modal visible={showProteinModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <Text style={[styles.modalTitle, { color: '#E65100' }]}>🥩 Log Protein</Text>

            <View style={{ backgroundColor: '#FFF3E0', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 2, borderColor: '#FF9800' }}>
              <Text style={[styles.inputLabel, { marginBottom: 8, color: '#E65100', fontWeight: 'bold' }]}>Daily Protein Intake</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.weightInput, { marginBottom: 0, borderColor: '#FF9800' }]}
                  value={proteinInput}
                  onChangeText={setProteinInput}
                  placeholder="Enter grams (e.g. 80)"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                  autoFocus
                />
                <Text style={[styles.unitLabel, { color: '#E65100' }]}>g</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.inputLabel, { marginBottom: 0, marginRight: 12 }]}>Date:</Text>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="compact"
                onChange={(event, date) => date && setSelectedDate(date)}
                maximumDate={new Date()}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowProteinModal(false); setProteinInput(''); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#FF9800' }]} onPress={handleAddProtein}>
                <Text style={styles.saveButtonText}>Save Protein</Text>
              </TouchableOpacity>
            </View>
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
  chartContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 16,
    padding: 12,
  },
  chartRangeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  rangeButtonActive: {
    backgroundColor: '#4A90D9',
  },
  rangeButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  rangeButtonTextActive: {
    color: '#fff',
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
    backgroundColor: '#4A90D9',
  },
  unitButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  entryItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryInfo: {
    flex: 1,
  },
  entryWeight: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  entryDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  entryNotes: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proteinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  proteinText: {
    fontSize: 12,
    color: '#4A90D9',
    fontWeight: '500',
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
    backgroundColor: '#4A90D9',
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
    paddingBottom: 48,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
  },
  unitLabel: {
    marginLeft: 12,
    fontSize: 18,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  datePicker: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
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
    backgroundColor: '#4A90D9',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
