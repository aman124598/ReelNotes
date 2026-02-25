import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Note } from '../types';
import { theme } from '../theme';

interface NoteCardProps {
  note: Note;
  onPress: () => void;
  onDelete: () => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onPress, onDelete }) => {
  const PROCESSING_TIMEOUT_MS = 3 * 60 * 1000;
  const noteUpdatedAt = new Date(note.updated_at || note.created_at).getTime();
  const isLiveProcessing = note.status === 'queued' || note.status === 'processing';
  const isStaleProcessing = isLiveProcessing && (Date.now() - noteUpdatedAt > PROCESSING_TIMEOUT_MS);

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

  const contentTypePalette: Record<string, { accent: string; soft: string }> = {
    Recipe: { accent: '#FFB347', soft: 'rgba(255, 179, 71, 0.18)' },
    Workout: { accent: '#7CFFB2', soft: 'rgba(124, 255, 178, 0.18)' },
    Travel: { accent: '#6BCBFF', soft: 'rgba(107, 203, 255, 0.18)' },
    Educational: { accent: '#B28DFF', soft: 'rgba(178, 141, 255, 0.18)' },
    DIY: { accent: '#FF8FAB', soft: 'rgba(255, 143, 171, 0.18)' },
    Other: { accent: theme.colors.accent, soft: theme.colors.accentSoft },
  };

  const palette = contentTypePalette[note.content_type] || {
    accent: theme.colors.accent,
    soft: theme.colors.accentSoft,
  };

  const getStatusLabel = () => {
    if (isStaleProcessing) return 'DELAYED';
    if (note.status === 'queued') return 'QUEUED';
    if (note.status === 'processing') return 'PROCESSING';
    if (note.status === 'ready') return 'READY';
    return 'FAILED';
  };

  const getStatusStyle = () => {
    if (isStaleProcessing) return styles.statusDelayed;
    if (note.status === 'ready') return styles.statusReady;
    if (note.status === 'failed') return styles.statusFailed;
    return styles.statusActive;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.accentBar, { backgroundColor: palette.accent }]} />

      <View style={styles.cardContent}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.emoji}>{getContentTypeEmoji(note.content_type)}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {note.title || 'Untitled Note'}
            </Text>
          </View>
          <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.tag, { backgroundColor: palette.soft }]}>
            <Text style={[styles.tagText, { color: palette.accent }]}>{note.content_type}</Text>
          </View>
          <View style={[styles.statusPill, getStatusStyle()]}>
            <Text style={styles.statusText}>{getStatusLabel()}</Text>
          </View>
          <Text style={styles.date}>
            {new Date(note.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>

        <Text style={styles.preview} numberOfLines={3}>
          {isStaleProcessing
            ? 'Processing is delayed. Open this note to retry.'
            : isLiveProcessing
            ? 'Processing speech and building recipe notes...'
            : (note.structured_text || 'No notes yet. Tap to add details.')}
        </Text>
      </View>
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
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
    position: 'relative',
    ...theme.shadows.soft,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.colors.primary,
  },
  cardContent: {
    paddingLeft: theme.spacing.sm,
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
    fontSize: 22,
    marginRight: theme.spacing.sm,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.text,
    flex: 1,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundAlt,
  },
  deleteText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  tag: {
    backgroundColor: theme.colors.accentSoft,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
  },
  tagText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  preview: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  statusPill: {
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
  },
  statusActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  statusReady: {
    backgroundColor: 'rgba(101, 243, 163, 0.18)',
  },
  statusDelayed: {
    backgroundColor: 'rgba(255, 179, 71, 0.2)',
  },
  statusFailed: {
    backgroundColor: theme.colors.primarySoft,
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  date: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
});
