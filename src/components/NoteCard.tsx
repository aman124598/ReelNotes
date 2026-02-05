import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Note } from '../types';
import { theme } from '../theme';

interface NoteCardProps {
  note: Note;
  onPress: () => void;
  onDelete: () => void;
}

const { width } = Dimensions.get('window');

export const NoteCard: React.FC<NoteCardProps> = ({ note, onPress, onDelete }) => {
  const getContentTypeEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      Recipe: '🍳',
      Workout: '💪',
      Travel: '✈️',
      Educational: '📚',
      DIY: '🔨',
      Other: '📌',
    };
    return emojis[type] || '📌';
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.emoji}>{getContentTypeEmoji(note.content_type)}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {note.title}
          </Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.contentType}>{note.content_type}</Text>

      <Text style={styles.preview} numberOfLines={3}>
        {note.structured_text}
      </Text>

      <Text style={styles.date}>
        {new Date(note.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: width - theme.spacing.lg * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emoji: {
    fontSize: 24,
    marginRight: theme.spacing.sm,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.text,
    flex: 1,
  },
  deleteButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  deleteText: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  contentType: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  preview: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  date: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
});
