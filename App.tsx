// Required for AWS Amplify - must be first import
import 'react-native-get-random-values';

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { 
  ActivityIndicator, 
  View, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  Text,
  Animated,
  Pressable,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// AWS Amplify
import { Amplify } from 'aws-amplify';
import awsConfig, { isAWSConfigured } from './src/aws/amplifyConfigure';
import { AuthProvider } from './src/aws/AuthContext';

// Biometric
import { BiometricProvider, useBiometric } from './src/auth/BiometricContext';
import { LockScreen } from './src/screens/LockScreen';

// Screens
import DashboardScreen from './src/screens/DashboardScreen';
import WeightScreen from './src/screens/WeightScreen';
import MeasurementsScreen from './src/screens/MeasurementsScreen';
import ChartsScreen from './src/screens/ChartsScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import ZepboundScreen from './src/screens/ZepboundScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';

// Database & Theme
import { initDatabase } from './src/database/db';
import { colors } from './src/theme/colors';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

// Configure Amplify (only if AWS is set up)
if (isAWSConfigured()) {
  try {
    Amplify.configure(awsConfig);
  } catch (e) {
    console.log('Amplify not configured yet');
  }
}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Custom Tab Bar with central FAB
function CustomTabBar({ state, descriptors, navigation }: any) {
  const { themeColors, isDarkMode } = useTheme();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const showLogModal = () => {
    setLogModalVisible(true);
    Animated.spring(fadeAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const hideLogModal = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setLogModalVisible(false));
  };

  const handleLogOption = (screen: string) => {
    hideLogModal();
    setTimeout(() => navigation.navigate(screen), 100);
  };

  return (
    <>
      <View style={[tabStyles.tabBar, { 
        backgroundColor: isDarkMode ? themeColors.surface : colors.surface,
        borderTopColor: isDarkMode ? themeColors.background : colors.border,
      }]}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          // Center FAB placeholder (skip Log tab - we'll render FAB separately)
          if (route.name === 'LogPlaceholder') {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={showLogModal}
                style={tabStyles.fabContainer}
              >
                <View style={[tabStyles.fab, { backgroundColor: themeColors.primary }]}>
                  <Ionicons name="add" size={32} color="#fff" />
                </View>
              </TouchableOpacity>
            );
          }

          let iconName: keyof typeof Ionicons.glyphMap;
          switch (route.name) {
            case 'Home':
              iconName = isFocused ? 'home' : 'home-outline';
              break;
            case 'Progress':
              iconName = isFocused ? 'trending-up' : 'trending-up-outline';
              break;
            case 'Coach':
              iconName = isFocused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
              break;
            case 'Meds':
              iconName = isFocused ? 'medical' : 'medical-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={tabStyles.tabButton}
            >
              <Ionicons 
                name={iconName} 
                size={24} 
                color={isFocused ? themeColors.primary : (isDarkMode ? themeColors.textSecondary : colors.textMuted)} 
              />
              <Text style={[
                tabStyles.tabLabel, 
                { color: isFocused ? themeColors.primary : (isDarkMode ? themeColors.textSecondary : colors.textMuted) }
              ]}>
                {options.title || route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Log Type Modal */}
      <Modal
        visible={logModalVisible}
        transparent
        animationType="none"
        onRequestClose={hideLogModal}
      >
        <Pressable style={tabStyles.modalOverlay} onPress={hideLogModal}>
          <Animated.View style={[
            tabStyles.modalContent,
            { 
              backgroundColor: isDarkMode ? themeColors.surface : colors.surface,
              transform: [{ scale: fadeAnim }],
              opacity: fadeAnim,
            }
          ]}>
            <Text style={[tabStyles.modalTitle, { color: isDarkMode ? themeColors.text : colors.text }]}>
              What would you like to log?
            </Text>
            
            <TouchableOpacity 
              style={[tabStyles.logOption, { backgroundColor: themeColors.primaryLight }]}
              onPress={() => handleLogOption('Weight')}
            >
              <View style={[tabStyles.logOptionIcon, { backgroundColor: themeColors.primary }]}>
                <Ionicons name="scale-outline" size={24} color="#fff" />
              </View>
              <View style={tabStyles.logOptionText}>
                <Text style={[tabStyles.logOptionTitle, { color: isDarkMode ? themeColors.text : colors.text }]}>
                  Weight
                </Text>
                <Text style={[tabStyles.logOptionDesc, { color: isDarkMode ? themeColors.textSecondary : colors.textSecondary }]}>
                  Log your daily weight
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themeColors.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[tabStyles.logOption, { backgroundColor: themeColors.secondaryLight }]}
              onPress={() => handleLogOption('Measurements')}
            >
              <View style={[tabStyles.logOptionIcon, { backgroundColor: themeColors.secondary }]}>
                <Ionicons name="body-outline" size={24} color="#fff" />
              </View>
              <View style={tabStyles.logOptionText}>
                <Text style={[tabStyles.logOptionTitle, { color: isDarkMode ? themeColors.text : colors.text }]}>
                  Measurements
                </Text>
                <Text style={[tabStyles.logOptionDesc, { color: isDarkMode ? themeColors.textSecondary : colors.textSecondary }]}>
                  Track body measurements
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themeColors.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[tabStyles.logOption, { backgroundColor: themeColors.accentLight }]}
              onPress={() => handleLogOption('Meds')}
            >
              <View style={[tabStyles.logOptionIcon, { backgroundColor: themeColors.accent }]}>
                <Ionicons name="medical-outline" size={24} color="#fff" />
              </View>
              <View style={tabStyles.logOptionText}>
                <Text style={[tabStyles.logOptionTitle, { color: isDarkMode ? themeColors.text : colors.text }]}>
                  Medication
                </Text>
                <Text style={[tabStyles.logOptionDesc, { color: isDarkMode ? themeColors.textSecondary : colors.textSecondary }]}>
                  Log Zepbound injection
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themeColors.accent} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={tabStyles.cancelButton}
              onPress={hideLogModal}
            >
              <Text style={[tabStyles.cancelButtonText, { color: isDarkMode ? themeColors.textSecondary : colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

// Placeholder component for FAB position in tab bar
function LogPlaceholderScreen() {
  return <View />;
}

// Header buttons component
function HeaderButtons({ navigation }: { navigation: any }) {
  return (
    <View style={{ flexDirection: 'row', marginRight: 16 }}>
      <TouchableOpacity 
        style={{ marginRight: 16 }}
        onPress={() => navigation.navigate('Insights')}
      >
        <Ionicons name="sparkles-outline" size={22} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={() => navigation.navigate('Settings')}
      >
        <Ionicons name="settings-outline" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function MainTabs({ navigation }: { navigation: any }) {
  const { themeColors, isDarkMode } = useTheme();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerRight: () => <HeaderButtons navigation={navigation} />,
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Progress" component={ChartsScreen} options={{ title: 'Progress' }} />
      <Tab.Screen 
        name="LogPlaceholder" 
        component={LogPlaceholderScreen} 
        options={{ title: '', tabBarButton: () => null }} 
      />
      <Tab.Screen name="Summary" component={SummaryScreen} options={{ title: 'AI Summary', headerShown: false }} />
      <Tab.Screen name="Meds" component={ZepboundScreen} options={{ title: 'Meds' }} />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 88,
    paddingTop: 8,
    paddingBottom: 28,
    borderTopWidth: 1,
    alignItems: 'flex-start',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  fabContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: -20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  logOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  logOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logOptionText: {
    flex: 1,
  },
  logOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  logOptionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const setup = async () => {
      try {
        await initDatabase();
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        setIsLoading(false);
      }
    };
    setup();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <BiometricProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BiometricProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const { themeColors } = useTheme();
  const { isLocked, isEnabled } = useBiometric();

  // Show lock screen if biometric is enabled and app is locked
  if (isEnabled && isLocked) {
    return <LockScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen 
            name="Progress" 
            component={ProgressScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: themeColors.primary },
              headerTintColor: '#fff',
              title: 'Your Progress',
            }}
          />
          <Stack.Screen 
            name="Measurements" 
            component={MeasurementsScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: themeColors.primary },
              headerTintColor: '#fff',
              title: 'Body Measurements',
            }}
          />
          <Stack.Screen 
            name="Insights" 
            component={InsightsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: themeColors.primary },
              headerTintColor: '#fff',
            }}
          />
          <Stack.Screen 
            name="Auth" 
            component={AuthScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: themeColors.primary },
              headerTintColor: '#fff',
              title: 'Sign In',
            }}
          />
          <Stack.Screen 
            name="Weight" 
            component={WeightScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: themeColors.primary },
              headerTintColor: '#fff',
              title: 'Log Weight',
            }}
          />
          <Stack.Screen 
            name="Meds" 
            component={ZepboundScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: themeColors.primary },
              headerTintColor: '#fff',
              title: 'Log Medication',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
