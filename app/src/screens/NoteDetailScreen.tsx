import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Button } from '../components/Button';
import { getNoteById, updateNote, deleteNote } from '../db';
import { Note } from '../types';
import { theme } from '../theme';

export const NoteDetailScreen = ({ route, navigation }: any) => {
  const { noteId } = route.params;
  const [note, setNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    const loadNote = () => {
      const loadedNote = getNoteById(noteId);
      if (loadedNote) {
        setNote(loadedNote);
        setEditedText(loadedNote.structured_text);
      } else {
        Alert.alert('Error', 'Note not found');
        navigation.goBack();
      }
    };

    loadNote();
  }, [noteId]);

  const handleSave = () => {
    if (!note) return;

    updateNote(note.id, { structured_text: editedText });
    setNote({ ...note, structured_text: editedText });
    setIsEditing(false);
    Alert.alert('Success', 'Note updated!');
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
          onPress: () => {
            if (note) {
              deleteNote(note.id);
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  if (!note) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button title="← Back" onPress={() => navigation.goBack()} variant="secondary" style={styles.backButton} />
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
        <Text style={styles.title}>{note.title}</Text>
        <Text style={styles.contentType}>{note.content_type}</Text>
        <Text style={styles.date}>
          {new Date(note.created_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>

        <View style={styles.divider} />

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
          <Text style={styles.structuredText}>{note.structured_text}</Text>
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
    paddingVertical: theme.spacing.md,
  },
  backButton: {
    paddingHorizontal: theme.spacing.md,
    minHeight: 40,
  },
  editButton: {
    paddingHorizontal: theme.spacing.md,
    minHeight: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  contentType: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  date: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
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
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    minHeight: 200,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metaSection: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metaLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  metaValue: {
    fontSize: 14,
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
    color: theme.colors.textMuted,
    fontSize: 16,
  },
});
