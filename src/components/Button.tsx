import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { theme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress, loading, variant = 'primary', style }) => {
  const variantStyle =
    variant === 'primary'
      ? styles.primaryButton
      : variant === 'secondary'
        ? styles.secondaryButton
        : styles.ghostButton;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : theme.colors.text} />
      ) : (
        <Text style={[styles.buttonText, variant === 'primary' ? styles.primaryText : styles.secondaryText]}>{title}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderWidth: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    ...theme.shadows.lift,
  },
  secondaryButton: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.borderSoft,
    ...theme.shadows.soft,
  },
  ghostButton: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.borderSoft,
  },
  buttonText: {
    ...theme.typography.button,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: theme.colors.text,
  },
});
