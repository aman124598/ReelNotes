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
import { getNoteById, updateNote, deleteNote } from '../services/supabase';
import { Note } from '../types';
import { theme } from '../theme';

export const NoteDetailScreen = ({ route, navigation }: any) => {
  const { noteId } = route.params;
  const [note, setNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();

    const loadNote = async () => {
      setLoading(true);
      const loadedNote = await getNoteById(noteId);
      if (loadedNote) {
        setNote(loadedNote);
        setEditedText(loadedNote.structured_text);
      } else {
        Alert.alert('Error', 'Note not found');
        navigation.goBack();
      }
      setLoading(false);
    };

    loadNote();
  }, [noteId]);

  const handleSave = async () => {
    if (!note) return;

    const success = await updateNote(note.id, { structured_text: editedText });
    if (success) {
      setNote({ ...note, structured_text: editedText });
      setIsEditing(false);
      Alert.alert('Success', 'Note updated!');
    } else {
      Alert.alert('Error', 'Failed to update note');
    }
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
        <View pointerEvents="none" style={styles.background}>
          <View style={styles.glowTop} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.background}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
      </View>
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.titleCard}>
            <Text style={styles.title}>{note.title || 'Untitled Note'}</Text>
            <View style={styles.metaRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{note.content_type}</Text>
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
              <Text style={styles.structuredText}>{note.structured_text}</Text>
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
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  glowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.colors.primarySoft,
    top: -160,
    right: -120,
    opacity: 0.9,
  },
  glowBottom: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: theme.colors.accentSoft,
    bottom: -210,
    left: -150,
    opacity: 0.8,
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
  contentWrapper: {
    flex: 1,
  },
  titleCard: {
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.borderRadius.lg,
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
  date: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  structuredText: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 24,
  },
  textInput: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    minHeight: 200,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    ...theme.shadows.soft,
  },
  contentCard: {
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    ...theme.shadows.soft,
  },
  metaSection: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.borderRadius.lg,
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
