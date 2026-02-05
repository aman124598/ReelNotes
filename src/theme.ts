export const theme = {
  colors: {
    primary: '#FF3B3B',
    background: '#0A0A0A',
    card: '#1A1A1A',
    text: '#FFFFFF',
    textMuted: '#AAAAAA',
    border: '#2A2A2A',
    error: '#FF5252',
    success: '#4CAF50',
  },
  typography: {
    title: {
      fontSize: 24,
      fontWeight: '800' as const,
    },
    heading: {
      fontSize: 18,
      fontWeight: '700' as const,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
    },
    caption: {
      fontSize: 14,
      fontWeight: '600' as const,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
};
