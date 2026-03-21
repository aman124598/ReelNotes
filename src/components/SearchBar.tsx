import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, placeholder = 'Search notes...' }) => {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <View style={styles.iconCircle} />
        <View style={styles.iconHandle} />
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 11,
    marginBottom: theme.spacing.lg,
  },
  icon: {
    width: 18,
    height: 18,
    marginRight: theme.spacing.sm,
    position: 'relative',
  },
  iconCircle: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.colors.textMuted,
  },
  iconHandle: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: theme.colors.textMuted,
    bottom: -1,
    right: -1,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.body,
    paddingVertical: 1,
  },
});
