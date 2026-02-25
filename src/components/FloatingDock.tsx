import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

interface FloatingDockProps {
  onHomePress?: () => void;
  onAddPress?: () => void;
  onLibraryPress?: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({ onHomePress, onAddPress, onLibraryPress }) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.dock}>
        <TouchableOpacity style={styles.iconButton} onPress={onHomePress}>
          <Text style={styles.iconText}>⌂</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={onLibraryPress}>
          <Text style={styles.iconText}>◴</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={onAddPress}>
          <Text style={styles.primaryText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={onLibraryPress}>
          <Text style={styles.iconText}>✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: 'center',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...theme.shadows.lift,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  iconText: {
    fontSize: 18,
    color: theme.colors.textMuted,
  },
  primaryButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    ...theme.shadows.soft,
  },
  primaryText: {
    fontSize: 26,
    lineHeight: 28,
    color: '#FFFFFF',
  },
});
