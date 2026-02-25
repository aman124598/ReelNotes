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
      duration: 450,
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
      Alert.alert('Success', 'Note updated!');
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
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
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
      ]
    );
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
          <Button title="Back" onPress={() => navigation.goBack()} variant="ghost" style={styles.backButton} />
          <Button
            title={isEditing ? 'Cancel' : 'Edit'}
            onPress={() => {
              if (isEditing) {
                setEditedText(note.structured_text);
              }
              setIsEditing(!isEditing);
            }}
            variant="secondary"
            style={styles.editButton}
          />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleCard}>
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
                <Text style={styles.statusText}>{isStaleProcessing ? 'DELAYED' : note.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.date}>
                {new Date(note.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          {isProcessing && !isStaleProcessing && (
            <View style={styles.processingBanner}>
              <Text style={styles.processingBannerText}>Processing speech and extracting recipe notes...</Text>
            </View>
          )}

          {isStaleProcessing && (
            <View style={styles.delayedBanner}>
              <Text style={styles.delayedTitle}>Processing is taking longer than expected</Text>
              <Text style={styles.delayedSubtext}>This note has been processing for about {processingMinutes} min.</Text>
              <View style={styles.delayedActions}>
                <Button title="Refresh Status" onPress={handleRefresh} variant="secondary" style={styles.delayedActionButton} />
                <Button
                  title={retrying ? 'Retrying...' : 'Retry Now'}
                  onPress={handleRetry}
                  loading={retrying}
                  style={styles.delayedActionButton}
                />
              </View>
            </View>
          )}

          {isFailed && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>
                {note.processing_error || 'The reel could not be processed. Try again.'}
              </Text>
              <Button
                title={retrying ? 'Retrying...' : 'Retry Processing'}
                onPress={handleRetry}
                loading={retrying}
                style={styles.retryButton}
              />
            </View>
          )}

          {isEditing ? (
            <TextInput
              style={styles.textInput}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              placeholder="Enter note content..."
              placeholderTextColor={theme.colors.textMuted}
            />
          ) : (
            <View style={styles.contentCard}>
              <Text style={styles.structuredText}>
                {note.structured_text || 'No extracted recipe text yet.'}
              </Text>
            </View>
          )}

          {note.url && (
            <View style={styles.metaSection}>
              <Text style={styles.metaLabel}>Source URL:</Text>
              <Text style={styles.metaValue}>{note.url}</Text>
            </View>
          )}
        </ScrollView>

        {isEditing ? (
          <View style={styles.footer}>
            <Button title="Save Changes" onPress={handleSave} />
          </View>
        ) : (
          <View style={styles.footer}>
            <Button title="Delete Note" onPress={handleDelete} variant="secondary" />
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    paddingHorizontal: theme.spacing.md,
    minHeight: 36,
  },
  editButton: {
    paddingHorizontal: theme.spacing.md,
    minHeight: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  contentContainer: {
    paddingBottom: theme.spacing.xxl,
    flexGrow: 1,
  },
  contentWrapper: {
    flex: 1,
    minHeight: 0,
  },
  titleCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    marginBottom: theme.spacing.md,
    ...theme.shadows.soft,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  statusPill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    marginHorizontal: theme.spacing.sm,
  },
  statusProcessing: {
    backgroundColor: theme.colors.accentSoft,
  },
  statusFailed: {
    backgroundColor: theme.colors.primarySoft,
  },
  statusDelayed: {
    backgroundColor: 'rgba(255, 179, 71, 0.18)',
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  date: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  processingBanner: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  processingBannerText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  delayedBanner: {
    backgroundColor: 'rgba(255, 179, 71, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 71, 0.35)',
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  delayedTitle: {
    ...theme.typography.heading,
    color: '#FFB347',
    marginBottom: theme.spacing.xs,
  },
  delayedSubtext: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  delayedActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  delayedActionButton: {
    marginRight: theme.spacing.sm,
  },
  errorBanner: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  errorBannerText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  structuredText: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 24,
  },
  textInput: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    minHeight: 200,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    ...theme.shadows.soft,
  },
  contentCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    ...theme.shadows.soft,
  },
  metaSection: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    ...theme.shadows.soft,
  },
  metaLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaValue: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
