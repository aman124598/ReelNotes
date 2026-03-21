import { Platform } from 'react-native';

const fonts = {
  display: Platform.select({
    ios: 'Georgia-Bold',
    android: 'serif',
    default: 'serif',
  }),
  title: Platform.select({
    ios: 'TrebuchetMS-Bold',
    android: 'sans-serif-medium',
    default: 'sans-serif',
  }),
  body: Platform.select({
    ios: 'TrebuchetMS',
    android: 'sans-serif',
    default: 'sans-serif',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

export const theme = {
  colors: {
    primary: '#D65A31',
    primarySoft: 'rgba(214, 90, 49, 0.14)',
    accent: '#0F766E',
    accentSoft: 'rgba(15, 118, 110, 0.14)',
    background: '#F6F1E9',
    backgroundAlt: '#FDF8EE',
    card: '#FFFDF9',
    cardElevated: '#FFFFFF',
    text: '#1A1B25',
    textMuted: '#555D6F',
    textSubtle: '#7A8195',
    border: '#E4D8C6',
    borderSoft: '#EEE4D5',
    error: '#C53030',
    success: '#1D8A69',
  },
  typography: {
    display: {
      fontFamily: fonts.display,
      fontSize: 36,
      lineHeight: 40,
      letterSpacing: -0.9,
      fontWeight: '800' as const,
    },
    title: {
      fontFamily: fonts.title,
      fontSize: 24,
      lineHeight: 29,
      letterSpacing: -0.45,
      fontWeight: '700' as const,
    },
    heading: {
      fontFamily: fonts.title,
      fontSize: 18,
      lineHeight: 23,
      letterSpacing: -0.2,
      fontWeight: '600' as const,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400' as const,
    },
    caption: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      letterSpacing: 0.35,
      fontWeight: '500' as const,
    },
    button: {
      fontFamily: fonts.title,
      fontSize: 15,
      lineHeight: 19,
      letterSpacing: 0.4,
      fontWeight: '700' as const,
    },
    mono: {
      fontFamily: fonts.mono,
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0.3,
      fontWeight: '500' as const,
    },
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  borderRadius: {
    sm: 8,
    md: 10,
    lg: 14,
    xl: 20,
  },
  shadows: {
    soft: {
      shadowColor: '#412512',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    lift: {
      shadowColor: '#412512',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
  },
};
