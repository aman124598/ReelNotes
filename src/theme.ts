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
    primary: '#4B8BFF',
    primarySoft: 'rgba(75, 139, 255, 0.14)',
    accent: '#5CB5FF',
    accentSoft: 'rgba(92, 181, 255, 0.14)',
    background: '#E9EEF7',
    backgroundAlt: '#F0F4FB',
    card: '#FFFFFF',
    cardElevated: '#F7FAFF',
    text: '#1F2633',
    textMuted: '#5D677B',
    textSubtle: '#7E889E',
    border: '#D7DEEC',
    borderSoft: '#E2E8F4',
    error: '#E95757',
    success: '#35B971',
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
    sm: 8,
    md: 12,
    lg: 14,
    xl: 18,
  },
  shadows: {
    soft: {
      shadowColor: '#1F2633',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    lift: {
      shadowColor: '#1F2633',
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
  },
};
