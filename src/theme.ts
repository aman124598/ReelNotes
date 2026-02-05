import { Platform } from 'react-native';

const fonts = {
  display: Platform.select({
    ios: 'AvenirNext-Heavy',
    android: 'sans-serif-black',
    default: 'System',
  }),
  title: Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  body: Platform.select({
    ios: 'AvenirNext-Regular',
    android: 'sans-serif',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

export const theme = {
  colors: {
    primary: '#FF4D3D',
    primarySoft: 'rgba(255, 77, 61, 0.16)',
    accent: '#7CFFB2',
    accentSoft: 'rgba(124, 255, 178, 0.14)',
    background: '#0B0C10',
    backgroundAlt: '#0F121A',
    card: '#141826',
    cardElevated: '#1A1F2E',
    text: '#F5F7FF',
    textMuted: '#A3ABC2',
    textSubtle: '#707993',
    border: '#23293B',
    borderSoft: '#2D3347',
    error: '#FF6B6B',
    success: '#65F3A3',
  },
  typography: {
    display: {
      fontFamily: fonts.display,
      fontSize: 32,
      lineHeight: 36,
      letterSpacing: -0.6,
      fontWeight: '800' as const,
    },
    title: {
      fontFamily: fonts.title,
      fontSize: 22,
      lineHeight: 26,
      letterSpacing: -0.3,
      fontWeight: '700' as const,
    },
    heading: {
      fontFamily: fonts.title,
      fontSize: 18,
      lineHeight: 22,
      letterSpacing: -0.1,
      fontWeight: '600' as const,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '400' as const,
    },
    caption: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0.2,
      fontWeight: '500' as const,
    },
    button: {
      fontFamily: fonts.title,
      fontSize: 15,
      lineHeight: 18,
      letterSpacing: 0.2,
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
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
  },
  shadows: {
    soft: {
      shadowColor: '#000',
      shadowOpacity: 0.24,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    lift: {
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
  },
};
