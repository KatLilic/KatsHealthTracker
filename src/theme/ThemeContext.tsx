import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@health_tracker_theme';
const PREFS_KEY = '@health_tracker_prefs';

// Theme color schemes
export const THEME_PRESETS = {
  rose: {
    label: 'Rose',
    primary: '#E8A4B8',
    primaryLight: '#F5D0D9',
    primaryDark: '#C67D93',
    secondary: '#B8A4E8',
    secondaryLight: '#D9D0F5',
    secondaryDark: '#8D7DC6',
    accent: '#A4D8E8',
    accentLight: '#D0EEF5',
    accentDark: '#7DB8C6',
    background: '#FFF9F9',
    surface: '#FFFFFF',
    text: '#4A3B40',
    textSecondary: '#8B7D82',
    chartLine: '#E8A4B8',
    chartFill: 'rgba(232, 164, 184, 0.2)',
    gradient: ['#F5D0D9', '#E8A4B8'],
  },
  lavender: {
    label: 'Lavender',
    primary: '#B8A4E8',
    primaryLight: '#D9D0F5',
    primaryDark: '#8D7DC6',
    secondary: '#E8A4B8',
    secondaryLight: '#F5D0D9',
    secondaryDark: '#C67D93',
    accent: '#A4D8E8',
    accentLight: '#D0EEF5',
    accentDark: '#7DB8C6',
    background: '#F9F7FF',
    surface: '#FFFFFF',
    text: '#3B3540',
    textSecondary: '#7D7B8B',
    chartLine: '#B8A4E8',
    chartFill: 'rgba(184, 164, 232, 0.2)',
    gradient: ['#D9D0F5', '#B8A4E8'],
  },
  sage: {
    label: 'Sage',
    primary: '#8FBC8F',
    primaryLight: '#C5DFC5',
    primaryDark: '#6B9B6B',
    secondary: '#B8A4E8',
    secondaryLight: '#D9D0F5',
    secondaryDark: '#8D7DC6',
    accent: '#E8C9A4',
    accentLight: '#F5E4D0',
    accentDark: '#C6A87D',
    background: '#F7FBF7',
    surface: '#FFFFFF',
    text: '#3B4A3B',
    textSecondary: '#7D8B7D',
    chartLine: '#8FBC8F',
    chartFill: 'rgba(143, 188, 143, 0.2)',
    gradient: ['#C5DFC5', '#8FBC8F'],
  },
  ocean: {
    label: 'Ocean',
    primary: '#7EB5D6',
    primaryLight: '#B8D9EC',
    primaryDark: '#5A96B8',
    secondary: '#D6A47E',
    secondaryLight: '#ECd9B8',
    secondaryDark: '#B8865A',
    accent: '#A4E8D0',
    accentLight: '#D0F5E8',
    accentDark: '#7DC6A8',
    background: '#F5FAFF',
    surface: '#FFFFFF',
    text: '#354050',
    textSecondary: '#7D889B',
    chartLine: '#7EB5D6',
    chartFill: 'rgba(126, 181, 214, 0.2)',
    gradient: ['#B8D9EC', '#7EB5D6'],
  },
  peach: {
    label: 'Peach',
    primary: '#F0A890',
    primaryLight: '#F8D4C8',
    primaryDark: '#D08868',
    secondary: '#90C0F0',
    secondaryLight: '#C8DCF8',
    secondaryDark: '#6898D0',
    accent: '#E8D0A4',
    accentLight: '#F5E8D0',
    accentDark: '#C6B07D',
    background: '#FFFAF7',
    surface: '#FFFFFF',
    text: '#504035',
    textSecondary: '#9B887D',
    chartLine: '#F0A890',
    chartFill: 'rgba(240, 168, 144, 0.2)',
    gradient: ['#F8D4C8', '#F0A890'],
  },
  midnight: {
    label: 'Midnight',
    primary: '#9B8EC4',
    primaryLight: '#C5BDDC',
    primaryDark: '#7B6EA8',
    secondary: '#C48E9B',
    secondaryLight: '#DCC5BD',
    secondaryDark: '#A86E7B',
    accent: '#8EBCC4',
    accentLight: '#BDD8DC',
    accentDark: '#6E9CA8',
    background: '#F5F3F8',
    surface: '#FFFFFF',
    text: '#2D2838',
    textSecondary: '#6B6578',
    chartLine: '#9B8EC4',
    chartFill: 'rgba(155, 142, 196, 0.2)',
    gradient: ['#C5BDDC', '#9B8EC4'],
  },
  sunset: {
    label: 'Sunset',
    primary: '#FF8C69',
    primaryLight: '#FFB8A0',
    primaryDark: '#E06B48',
    secondary: '#FFD166',
    secondaryLight: '#FFE5A0',
    secondaryDark: '#E0B046',
    accent: '#EF476F',
    accentLight: '#F8A0B8',
    accentDark: '#D02050',
    background: '#FFF8F5',
    surface: '#FFFFFF',
    text: '#4A3530',
    textSecondary: '#9B7570',
    chartLine: '#FF8C69',
    chartFill: 'rgba(255, 140, 105, 0.2)',
    gradient: ['#FFB8A0', '#FF8C69'],
  },
  forest: {
    label: 'Forest',
    primary: '#2D6A4F',
    primaryLight: '#74C69D',
    primaryDark: '#1B4332',
    secondary: '#40916C',
    secondaryLight: '#95D5B2',
    secondaryDark: '#2D6A4F',
    accent: '#D8F3DC',
    accentLight: '#E8F8EC',
    accentDark: '#B7E4C7',
    background: '#F2F9F4',
    surface: '#FFFFFF',
    text: '#1B3D2F',
    textSecondary: '#4A7C5F',
    chartLine: '#40916C',
    chartFill: 'rgba(64, 145, 108, 0.2)',
    gradient: ['#74C69D', '#2D6A4F'],
  },
  coral: {
    label: 'Coral',
    primary: '#FF6B6B',
    primaryLight: '#FFA0A0',
    primaryDark: '#E04B4B',
    secondary: '#4ECDC4',
    secondaryLight: '#A0E8E4',
    secondaryDark: '#2EB0A8',
    accent: '#FFE66D',
    accentLight: '#FFF0A0',
    accentDark: '#E0C84D',
    background: '#FFF9F9',
    surface: '#FFFFFF',
    text: '#3A2D2D',
    textSecondary: '#8B7070',
    chartLine: '#FF6B6B',
    chartFill: 'rgba(255, 107, 107, 0.2)',
    gradient: ['#FFA0A0', '#FF6B6B'],
  },
  berry: {
    label: 'Berry',
    primary: '#8B5CF6',
    primaryLight: '#C4B5FD',
    primaryDark: '#6D28D9',
    secondary: '#EC4899',
    secondaryLight: '#F9A8D4',
    secondaryDark: '#DB2777',
    accent: '#06B6D4',
    accentLight: '#67E8F9',
    accentDark: '#0891B2',
    background: '#FAF5FF',
    surface: '#FFFFFF',
    text: '#3B2050',
    textSecondary: '#7B6090',
    chartLine: '#8B5CF6',
    chartFill: 'rgba(139, 92, 246, 0.2)',
    gradient: ['#C4B5FD', '#8B5CF6'],
  },
  slate: {
    label: 'Slate',
    primary: '#818CF8',
    primaryLight: '#A5B4FC',
    primaryDark: '#6366F1',
    secondary: '#F472B6',
    secondaryLight: '#F9A8D4',
    secondaryDark: '#EC4899',
    accent: '#34D399',
    accentLight: '#6EE7B7',
    accentDark: '#10B981',
    background: '#1E1E2E',
    surface: '#2A2A3E',
    text: '#E2E8F0',
    textSecondary: '#94A3B8',
    chartLine: '#818CF8',
    chartFill: 'rgba(129, 140, 248, 0.2)',
    gradient: ['#6366F1', '#818CF8'],
  },
  // Dark mode themes - all have dark backgrounds
  roseDark: {
    label: 'Rose',
    primary: '#F0B8C8',
    primaryLight: '#F8D4E0',
    primaryDark: '#D090A5',
    secondary: '#C8B8F0',
    secondaryLight: '#E0D4F8',
    secondaryDark: '#A090D0',
    accent: '#B8E8F0',
    accentLight: '#D4F0F8',
    accentDark: '#90C8D0',
    background: '#1A1418',
    surface: '#2A2025',
    text: '#F5E8EC',
    textSecondary: '#C0A8B0',
    chartLine: '#F0B8C8',
    chartFill: 'rgba(240, 184, 200, 0.2)',
    gradient: ['#D090A5', '#F0B8C8'],
  },
  lavenderDark: {
    label: 'Lavender',
    primary: '#C8B8F0',
    primaryLight: '#E0D4F8',
    primaryDark: '#A090D0',
    secondary: '#F0B8C8',
    secondaryLight: '#F8D4E0',
    secondaryDark: '#D090A5',
    accent: '#B8E8F0',
    accentLight: '#D4F0F8',
    accentDark: '#90C8D0',
    background: '#18141A',
    surface: '#25202A',
    text: '#F0E8F5',
    textSecondary: '#B0A8C0',
    chartLine: '#C8B8F0',
    chartFill: 'rgba(200, 184, 240, 0.2)',
    gradient: ['#A090D0', '#C8B8F0'],
  },
  sageDark: {
    label: 'Sage',
    primary: '#A8D4A8',
    primaryLight: '#C8E8C8',
    primaryDark: '#80B080',
    secondary: '#C8B8F0',
    secondaryLight: '#E0D4F8',
    secondaryDark: '#A090D0',
    accent: '#F0D8B8',
    accentLight: '#F8E8D4',
    accentDark: '#D0B890',
    background: '#141814',
    surface: '#202820',
    text: '#E8F5E8',
    textSecondary: '#A8C0A8',
    chartLine: '#A8D4A8',
    chartFill: 'rgba(168, 212, 168, 0.2)',
    gradient: ['#80B080', '#A8D4A8'],
  },
  oceanDark: {
    label: 'Ocean',
    primary: '#90C5E8',
    primaryLight: '#B8D8F0',
    primaryDark: '#68A0C8',
    secondary: '#E8B890',
    secondaryLight: '#F0D8B8',
    secondaryDark: '#C89068',
    accent: '#B8F0E0',
    accentLight: '#D4F8F0',
    accentDark: '#90D0C0',
    background: '#101820',
    surface: '#182530',
    text: '#E8F0F8',
    textSecondary: '#A0B8C8',
    chartLine: '#90C5E8',
    chartFill: 'rgba(144, 197, 232, 0.2)',
    gradient: ['#68A0C8', '#90C5E8'],
  },
  peachDark: {
    label: 'Peach',
    primary: '#F8B8A0',
    primaryLight: '#FCD8C8',
    primaryDark: '#D89070',
    secondary: '#A0D0F8',
    secondaryLight: '#C8E0FC',
    secondaryDark: '#70A8D8',
    accent: '#F0E0B8',
    accentLight: '#F8F0D4',
    accentDark: '#D0C090',
    background: '#1A1410',
    surface: '#2A2018',
    text: '#F8F0E8',
    textSecondary: '#C8B0A0',
    chartLine: '#F8B8A0',
    chartFill: 'rgba(248, 184, 160, 0.2)',
    gradient: ['#D89070', '#F8B8A0'],
  },
  midnightDark: {
    label: 'Midnight',
    primary: '#B0A0D8',
    primaryLight: '#D0C8E8',
    primaryDark: '#8878B8',
    secondary: '#D8A0B0',
    secondaryLight: '#E8C8D0',
    secondaryDark: '#B87888',
    accent: '#A0C8D8',
    accentLight: '#C8E0E8',
    accentDark: '#78A0B8',
    background: '#141018',
    surface: '#201828',
    text: '#E8E0F0',
    textSecondary: '#A898B8',
    chartLine: '#B0A0D8',
    chartFill: 'rgba(176, 160, 216, 0.2)',
    gradient: ['#8878B8', '#B0A0D8'],
  },
  sunsetDark: {
    label: 'Sunset',
    primary: '#FF9878',
    primaryLight: '#FFC0A8',
    primaryDark: '#E07050',
    secondary: '#FFE080',
    secondaryLight: '#FFF0B0',
    secondaryDark: '#E0C060',
    accent: '#FF6080',
    accentLight: '#FFA0B8',
    accentDark: '#E04060',
    background: '#1A1210',
    surface: '#2A2018',
    text: '#FFF5F0',
    textSecondary: '#D0A090',
    chartLine: '#FF9878',
    chartFill: 'rgba(255, 152, 120, 0.2)',
    gradient: ['#E07050', '#FF9878'],
  },
  forestDark: {
    label: 'Forest',
    primary: '#50A878',
    primaryLight: '#88D0A8',
    primaryDark: '#308858',
    secondary: '#60B890',
    secondaryLight: '#98D8B8',
    secondaryDark: '#409870',
    accent: '#C8F8D8',
    accentLight: '#E0FCE8',
    accentDark: '#A0E0C0',
    background: '#0C1410',
    surface: '#142018',
    text: '#E0F8E8',
    textSecondary: '#90C8A0',
    chartLine: '#60B890',
    chartFill: 'rgba(96, 184, 144, 0.2)',
    gradient: ['#308858', '#50A878'],
  },
  coralDark: {
    label: 'Coral',
    primary: '#FF8080',
    primaryLight: '#FFB0B0',
    primaryDark: '#E05858',
    secondary: '#60E0D8',
    secondaryLight: '#98F0E8',
    secondaryDark: '#40C0B8',
    accent: '#FFF080',
    accentLight: '#FFF8B0',
    accentDark: '#E0D060',
    background: '#1A1010',
    surface: '#2A1818',
    text: '#FFF0F0',
    textSecondary: '#D09090',
    chartLine: '#FF8080',
    chartFill: 'rgba(255, 128, 128, 0.2)',
    gradient: ['#E05858', '#FF8080'],
  },
  berryDark: {
    label: 'Berry',
    primary: '#A078FF',
    primaryLight: '#C8B0FF',
    primaryDark: '#7850E0',
    secondary: '#FF68A8',
    secondaryLight: '#FFA0C8',
    secondaryDark: '#E04888',
    accent: '#20C8E0',
    accentLight: '#68E0F0',
    accentDark: '#00A8C0',
    background: '#14101A',
    surface: '#201828',
    text: '#F8F0FF',
    textSecondary: '#B0A0C8',
    chartLine: '#A078FF',
    chartFill: 'rgba(160, 120, 255, 0.2)',
    gradient: ['#7850E0', '#A078FF'],
  },
  custom: {
    label: 'Custom',
    primary: '#E8A4B8',
    primaryLight: '#F5D0D9',
    primaryDark: '#C67D93',
    secondary: '#B8A4E8',
    secondaryLight: '#D9D0F5',
    secondaryDark: '#8D7DC6',
    accent: '#A4D8E8',
    accentLight: '#D0EEF5',
    accentDark: '#7DB8C6',
    background: '#FFF9F9',
    surface: '#FFFFFF',
    text: '#4A3B40',
    textSecondary: '#8B7D82',
    chartLine: '#E8A4B8',
    chartFill: 'rgba(232, 164, 184, 0.2)',
    gradient: ['#F5D0D9', '#E8A4B8'],
  },
};

export type ThemePresetKey = keyof typeof THEME_PRESETS;

export interface UserPreferences {
  theme: ThemePresetKey;
  themeMode: 'light' | 'dark' | 'system'; // New: support system dark mode
  weightUnit: 'lbs' | 'kg';
  measurementUnit: 'in' | 'cm';
  showBMI: boolean;
  showGoalLine: boolean;
  chartStyle: 'curved' | 'straight';
  dashboardCards: string[];
  defaultChartRange: '7' | '30' | '90' | '365';
  showMotivation: boolean;
  darkModeTheme: ThemePresetKey; // Which theme to use in dark mode
  customColors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
}

const DEFAULT_PREFS: UserPreferences = {
  theme: 'rose',
  themeMode: 'system', // Default to system preference
  weightUnit: 'lbs',
  measurementUnit: 'in',
  showBMI: true,
  showGoalLine: true,
  chartStyle: 'curved',
  darkModeTheme: 'slate', // Default dark theme
  dashboardCards: ['weight', 'zepbound', 'measurements', 'insights'],
  defaultChartRange: '30',
  showMotivation: true,
};

// Helper to generate theme colors from a primary color
const generateThemeFromColor = (primary: string, secondary: string, accent: string, background: string) => {
  const lighten = (hex: string, percent: number) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
    const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * percent));
    const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * percent));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };
  const darken = (hex: string, percent: number) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
    const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - percent)));
    const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - percent)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  return {
    label: 'Custom',
    primary,
    primaryLight: lighten(primary, 0.3),
    primaryDark: darken(primary, 0.2),
    secondary,
    secondaryLight: lighten(secondary, 0.3),
    secondaryDark: darken(secondary, 0.2),
    accent,
    accentLight: lighten(accent, 0.3),
    accentDark: darken(accent, 0.2),
    background,
    surface: '#FFFFFF',
    text: darken(background, 0.85),
    textSecondary: darken(background, 0.5),
    chartLine: primary,
    chartFill: `rgba(${parseInt(primary.slice(1, 3), 16)}, ${parseInt(primary.slice(3, 5), 16)}, ${parseInt(primary.slice(5, 7), 16)}, 0.2)`,
    gradient: [lighten(primary, 0.3), primary],
  };
};

interface ThemeContextType {
  theme: ThemePresetKey;
  themeColors: typeof THEME_PRESETS.rose;
  prefs: UserPreferences;
  isDarkMode: boolean;
  setTheme: (key: ThemePresetKey) => Promise<void>;
  updatePrefs: (updates: Partial<UserPreferences>) => Promise<void>;
  setCustomColors: (colors: { primary: string; secondary: string; accent: string; background: string }) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'rose',
  themeColors: THEME_PRESETS.rose,
  prefs: DEFAULT_PREFS,
  isDarkMode: false,
  setTheme: async () => {},
  updatePrefs: async () => {},
  setCustomColors: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemePresetKey>('rose');
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [customTheme, setCustomTheme] = useState<typeof THEME_PRESETS.rose | null>(null);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const saved = await AsyncStorage.getItem(PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPrefs({ ...DEFAULT_PREFS, ...parsed });
        setThemeState(parsed.theme || 'rose');
        
        // Load custom colors if theme is custom
        if (parsed.theme === 'custom' && parsed.customColors) {
          const generated = generateThemeFromColor(
            parsed.customColors.primary,
            parsed.customColors.secondary,
            parsed.customColors.accent,
            parsed.customColors.background
          );
          setCustomTheme(generated);
        }
      }
    } catch (e) {
      console.error('Failed to load prefs:', e);
    }
  };

  const setTheme = async (key: ThemePresetKey) => {
    setThemeState(key);
    const newPrefs = { ...prefs, theme: key };
    setPrefs(newPrefs);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
  };

  const updatePrefs = async (updates: Partial<UserPreferences>) => {
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
  };

  const setCustomColors = async (colors: { primary: string; secondary: string; accent: string; background: string }) => {
    const generated = generateThemeFromColor(colors.primary, colors.secondary, colors.accent, colors.background);
    setCustomTheme(generated);
    const newPrefs = { ...prefs, theme: 'custom' as ThemePresetKey, customColors: colors };
    setPrefs(newPrefs);
    setThemeState('custom');
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
  };

  // Determine effective theme based on themeMode and system preference
  const getEffectiveTheme = (): ThemePresetKey => {
    if (prefs.themeMode === 'system') {
      // Use system preference
      return systemColorScheme === 'dark' ? (prefs.darkModeTheme || 'slate') : theme;
    } else if (prefs.themeMode === 'dark') {
      return prefs.darkModeTheme || 'slate';
    }
    return theme;
  };

  const effectiveTheme = getEffectiveTheme();
  
  // Use custom theme if available and theme is 'custom', otherwise use preset
  const currentThemeColors = effectiveTheme === 'custom' && customTheme ? customTheme : THEME_PRESETS[effectiveTheme];
  
  // Check if currently in dark mode
  const isDarkMode = prefs.themeMode === 'dark' || (prefs.themeMode === 'system' && systemColorScheme === 'dark');

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeColors: currentThemeColors,
        prefs,
        isDarkMode,
        setTheme,
        updatePrefs,
        setCustomColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
