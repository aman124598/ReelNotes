import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../theme';

export const ScreenBackdrop = () => {
  return (
    <View pointerEvents="none" style={styles.background}>
      <View style={styles.base} />
      <View style={styles.coolOrb} />
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
  coolOrb: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -70,
    right: -50,
    backgroundColor: 'rgba(15, 118, 110, 0.1)',
  },
});
