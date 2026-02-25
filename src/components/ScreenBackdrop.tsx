import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../theme';

export const ScreenBackdrop = () => {
  return (
    <View pointerEvents="none" style={styles.background}>
      <View style={styles.base} />
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
});
