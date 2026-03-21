import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { getNoteById, updateNote, deleteNote, retryReelProcessing } from '../services/supabase';
import { Note } from '../types';
import { theme } from '../theme';

export const NoteDetailScreen = ({ route, navigation }: any) => {
  const PROCESSING_TIMEOUT_MS = 3 * 60 * 1000;
  const { noteId } = route.params;
  const [note, setNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();

    const refreshNote = async (isInitial = false) => {
      if (isInitial) setLoading(true);

      const loadedNote = await getNoteById(noteId);
      if (!mounted) return;

      if (!loadedNote) {
        Alert.alert('Error', 'Note not found');
        navigation.goBack();
        return;
      }

      setNote(loadedNote);
      if (!isEditing) {
        setEditedText(loadedNote.structured_text);
      }

      if (isInitial) {
        setLoading(false);
      }

      const isProcessing = loadedNote.status === 'queued' || loadedNote.status === 'processing';
      const updatedAt = new Date(loadedNote.updated_at || loadedNote.created_at).getTime();
      const isStale = Date.now() - updatedAt > PROCESSING_TIMEOUT_MS;

      if (isProcessing && !isStale) {
        timer = setTimeout(() => refreshNote(false), 4000);
      }
    };

    refreshNote(true);

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [noteId, navigation, isEditing, fadeAnim]);

  const handleSave = async () => {
    if (!note) return;
    if (!editedText.trim()) {
      Alert.alert('Empty Note', 'Note content cannot be empty.');
      return;
    }

    const success = await updateNote(note.id, { structured_text: editedText });
    if (success) {
      setNote({ ...note, structured_text: editedText });
      setIsEditing(false);
      Alert.alert('Saved', 'Your note was updated.');
    } else {
      Alert.alert('Error', 'Failed to update note');
    }
  };

  const handleRetry = async () => {
    if (!note) return;
    setRetrying(true);
    const { error } = await retryReelProcessing(note.id);
    setRetrying(false);

    if (error) {
      Alert.alert('Retry Failed', error);
      return;
    }

    setNote({
      ...note,
      status: 'queued',
      processing_error: undefined,
      structured_text: note.structured_text || 'Processing speech and extracting recipe notes...',
    });
  };

  const handleDelete = () => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (note) {
            const success = await deleteNote(note.id);
            if (success) {
              navigation.goBack();
            } else {
              Alert.alert('Error', 'Failed to delete note');
            }
          }
        },
      },
    ]);
  };

  if (loading || !note) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenBackdrop />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isProcessing = note.status === 'queued' || note.status === 'processing';
  const isFailed = note.status === 'failed';
  const processingAgeMs = Date.now() - new Date(note.updated_at || note.created_at).getTime();
  const isStaleProcessing = isProcessing && processingAgeMs > PROCESSING_TIMEOUT_MS;
  const processingMinutes = Math.max(1, Math.floor(processingAgeMs / 60000));

  const handleRefresh = async () => {
    const latest = await getNoteById(noteId);
    if (latest) {
      setNote(latest);
      if (!isEditing) setEditedText(latest.structured_text);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackdrop />
      <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Button title="Back" onPress={() => navigation.goBack()} variant="ghost" style={styles.headerButton} />
          <Button
            title={isEditing ? 'Cancel' : 'Edit'}
            onPress={() => {
              if (isEditing) {
                setEditedText(note.structured_text);
              }
              setIsEditing(!isEditing);
            }}
            variant="secondary"
            style={styles.headerButton}
          />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>NOTE DETAIL</Text>
            <Text style={styles.title}>{note.title || 'Untitled Note'}</Text>
            <View style={styles.metaRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{note.content_type}</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  isFailed ? styles.statusFailed : isStaleProcessing ? styles.statusDelayed : styles.statusProcessing,
                ]}
              >
                <Text style={styles.statusText}>{isStaleProcessing ? 'Delayed' : note.status}</Text>
              </View>
            </View>
          </View>

          {isProcessing && !isStaleProcessing && (
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>Processing speech and extracting recipe notes...</Text>
            </View>
          )}

          {isStaleProcessing && (
            <View style={styles.warnBanner}>
              <Text style={styles.warnTitle}>Processing is delayed</Text>
              <Text style={styles.warnText}>This has been running for about {processingMinutes} min.</Text>
              <View style={styles.rowButtons}>
                <Button title="Refresh" onPress={handleRefresh} variant="secondary" style={styles.rowButton} />
                <Button title={retrying ? 'Retrying...' : 'Retry'} onPress={handleRetry} loading={retrying} style={styles.rowButton} />
              </View>
            </View>
          )}

          {isFailed && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{note.processing_error || 'The reel could not be processed. Try again.'}</Text>
              <Button title={retrying ? 'Retrying...' : 'Retry Processing'} onPress={handleRetry} loading={retrying} />
            </View>
          )}

          {isEditing ? (
            <TextInput
              style={styles.editor}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              placeholder="Enter note content..."
              placeholderTextColor={theme.colors.textMuted}
              textAlignVertical="top"
            />
          ) : (
            <View style={styles.noteCard}>
              <Text style={styles.structuredText}>{note.structured_text || 'No extracted recipe text yet.'}</Text>
            </View>
          )}

          {note.url ? (
            <View style={styles.sourceCard}>
              <Text style={styles.sourceLabel}>Source URL</Text>
              <Text style={styles.sourceValue}>{note.url}</Text>
            </View>
          ) : null}

          <View style={styles.dateWrap}>
            <Text style={styles.dateText}>
              Created {new Date(note.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {isEditing ? (
            <Button title="Save Changes" onPress={handleSave} />
          ) : (
            <Button title="Delete Note" onPress={handleDelete} variant="secondary" />
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentWrapper: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 0,
    paddingBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerButton: {
    minWidth: 90,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  contentContainer: {
    paddingBottom: theme.spacing.xl,
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  eyebrow: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    backgroundColor: theme.colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    marginRight: theme.spacing.sm,
  },
  tagText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    textTransform: 'uppercase',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  statusProcessing: {
    backgroundColor: theme.colors.primarySoft,
  },
  statusDelayed: {
    backgroundColor: 'rgba(214, 90, 49, 0.2)',
  },
  statusFailed: {
    backgroundColor: 'rgba(197, 48, 48, 0.18)',
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    textTransform: 'uppercase',
  },
  infoBanner: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  infoText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  warnBanner: {
    backgroundColor: 'rgba(214, 90, 49, 0.12)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(214, 90, 49, 0.35)',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  warnTitle: {
    ...theme.typography.heading,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  warnText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  rowButtons: {
    flexDirection: 'row',
  },
  rowButton: {
    marginRight: theme.spacing.sm,
  },
  errorBanner: {
    backgroundColor: 'rgba(197, 48, 48, 0.08)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(197, 48, 48, 0.32)',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  noteCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    padding: theme.spacing.md,
  },
  structuredText: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 25,
  },
  editor: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    padding: theme.spacing.md,
    minHeight: 220,
  },
  sourceCard: {
    marginTop: theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    padding: theme.spacing.md,
  },
  sourceLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sourceValue: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  dateWrap: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  dateText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
