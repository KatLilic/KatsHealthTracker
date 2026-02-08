// Soft/Feminine color theme for the health tracker app

export const colors = {
  // Primary palette - soft rose/blush
  primary: '#E8A4B8',
  primaryLight: '#F5D0D9',
  primaryDark: '#C67D93',
  
  // Secondary palette - soft lavender
  secondary: '#B8A4E8',
  secondaryLight: '#D9D0F5',
  secondaryDark: '#8D7DC6',
  
  // Accent colors
  accent: '#A4D8E8',      // Soft teal
  accentLight: '#D0EEF5',
  accentDark: '#7DB8C6',
  
  // Semantic colors
  success: '#A8E6CF',     // Soft mint
  successLight: '#D0F5E8',
  successDark: '#78C6A8',
  
  warning: '#FFE5B4',     // Soft peach
  warningDark: '#E6C6A0',
  
  error: '#FFB4B4',       // Soft coral
  errorDark: '#E69696',
  
  // Neutrals - warm tones
  background: '#FFF9F9',   // Warm white with pink tint
  surface: '#FFFFFF',
  surfaceElevated: '#FFFCFC',
  
  card: '#FFFFFF',
  cardBorder: '#F5E8EB',
  
  // Text colors
  text: '#4A3B40',         // Warm dark brown
  textSecondary: '#8B7D82',
  textMuted: '#B8A8AD',
  textOnPrimary: '#FFFFFF',
  
  // Borders and dividers
  border: '#F0E4E8',
  divider: '#F8F0F2',
  
  // Shadows
  shadow: 'rgba(200, 150, 165, 0.15)',
  
  // Gradients (as arrays for LinearGradient)
  gradientPrimary: ['#F5D0D9', '#E8A4B8'],
  gradientSecondary: ['#D9D0F5', '#B8A4E8'],
  gradientAccent: ['#D0EEF5', '#A4D8E8'],
  gradientSuccess: ['#D0F5E8', '#A8E6CF'],
  gradientBackground: ['#FFFCFC', '#FFF9F9', '#FFF5F7'],
  
  // Tab bar
  tabActive: '#E8A4B8',
  tabInactive: '#B8A8AD',
  
  // Charts
  chartLine: '#E8A4B8',
  chartFill: 'rgba(232, 164, 184, 0.2)',
  chartGrid: '#F5E8EB',
  chartLabel: '#8B7D82',
  
  // Body model
  skinBase: '#F5D5C8',
  skinLight: '#FBE8DE',
  skinDark: '#E8C0B0',
  skinHighlight: '#FFF5F0',
  hair: '#3D2B1F',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
};

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#4A3B40',
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: '#4A3B40',
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#4A3B40',
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: '#4A3B40',
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: '#8B7D82',
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: '#B8A8AD',
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#8B7D82',
  },
};

export const shadows = {
  sm: {
    shadowColor: '#C896A5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#C896A5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#C896A5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
};

export default { colors, spacing, borderRadius, typography, shadows };
