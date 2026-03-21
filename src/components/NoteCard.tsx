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

  const contentTypePalette: Record<string, { accent: string; soft: string }> = {
    Recipe: { accent: '#D65A31', soft: 'rgba(214, 90, 49, 0.14)' },
    Workout: { accent: '#188A65', soft: 'rgba(24, 138, 101, 0.15)' },
    Travel: { accent: '#0369A1', soft: 'rgba(3, 105, 161, 0.13)' },
    Educational: { accent: '#7C3AED', soft: 'rgba(124, 58, 237, 0.12)' },
    DIY: { accent: '#BE185D', soft: 'rgba(190, 24, 93, 0.12)' },
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
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: theme.spacing.md,
    bottom: theme.spacing.md,
    width: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  cardContent: {
    paddingLeft: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  deleteText: {
    color: theme.colors.textMuted,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 999,
    paddingVertical: 3,
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
    paddingVertical: 3,
    paddingHorizontal: theme.spacing.sm,
  },
  statusActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  statusReady: {
    backgroundColor: 'rgba(29, 138, 105, 0.18)',
  },
  statusDelayed: {
    backgroundColor: 'rgba(214, 90, 49, 0.2)',
  },
  statusFailed: {
    backgroundColor: 'rgba(197, 48, 48, 0.16)',
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  date: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
});
