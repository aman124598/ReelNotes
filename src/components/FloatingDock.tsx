import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

interface FloatingDockProps {
  onAddPress?: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({ onAddPress }) => {
  return (
    <TouchableOpacity style={styles.button} onPress={onAddPress}>
      <Text style={styles.buttonText}>+</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lift,
  },
  buttonText: {
    fontSize: 26,
    lineHeight: 28,
    color: '#FFFFFF',
  },
});
