import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '../components/Button';
import { addNote } from '../db';
import { extractReelContent } from '../services/supabase';
import { formatWithGroq } from '../services/groq';
import { theme } from '../theme';

export const AddNoteScreen = ({ navigation }: any) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    title: string;
    contentType: string;
    structuredText: string;
    transcript?: string;
  } | null>(null);

  const handlePasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
    }
  };

  const validateInstagramUrl = (url: string): boolean => {
    const patterns = [
      /instagram\.com\/reel\/[A-Za-z0-9_-]+/,
      /instagram\.com\/p\/[A-Za-z0-9_-]+/,
      /instagram\.com\/tv\/[A-Za-z0-9_-]+/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const handleExtract = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter an Instagram URL');
      return;
    }

    if (!validateInstagramUrl(url)) {
      Alert.alert('Invalid URL', 'Please enter a valid Instagram reel or post URL');
      return;
    }

    setLoading(true);

    try {
      // Extract content from Instagram
      const { transcript, ocr, error } = await extractReelContent(url);

      if (error) {
        Alert.alert('Extraction Error', error);
        setLoading(false);
        return;
      }

      const content = transcript || ocr || '';

      if (!content) {
        Alert.alert('No Content', 'Could not extract content from this reel. You can still create a note manually.');
        setLoading(false);
        return;
      }

      // Format with Groq AI
      const formatted = await formatWithGroq(content);

      setExtractedData({
        ...formatted,
        transcript: content,
      });

      Alert.alert('Success', 'Content extracted and formatted!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to extract content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!extractedData) {
      Alert.alert('Error', 'Please extract content first');
      return;
    }

    const noteId = addNote({
      url: url.trim(),
      title: extractedData.title,
      content_type: extractedData.contentType,
      structured_text: extractedData.structuredText,
      raw_transcript: extractedData.transcript,
      status: 'ready',
    });

    Alert.alert('Success', 'Note saved!', [
      {
        text: 'OK',
        onPress: () => navigation.navigate('NoteDetail', { noteId }),
      },
    ]);
  };

  const handleManualCreate = () => {
    const noteId = addNote({
      url: url.trim() || 'Manual Entry',
      title: 'Untitled Note',
      content_type: 'Other',
      structured_text: '',
      status: 'draft',
    });

    navigation.navigate('NoteDetail', { noteId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button
          title="← Back"
          onPress={() => navigation.goBack()}
          variant="secondary"
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>New Note</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Instagram Reel URL</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.instagram.com/reel/..."
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            title="📋"
            onPress={handlePasteFromClipboard}
            variant="secondary"
            style={styles.pasteButton}
          />
        </View>

        <Button
          title="Extract Content"
          onPress={handleExtract}
          loading={loading}
          style={styles.extractButton}
        />

        {extractedData && (
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>Preview</Text>
            
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>{extractedData.title}</Text>
              <Text style={styles.previewContentType}>{extractedData.contentType}</Text>
              <Text style={styles.previewText} numberOfLines={10}>
                {extractedData.structuredText}
              </Text>
            </View>

            <Button
              title="Save Note"
              onPress={handleSave}
              style={styles.saveButton}
            />
          </View>
        )}

        <View style={styles.divider}>
          <Text style={styles.dividerText}>OR</Text>
        </View>

        <Button
          title="Create Manual Note"
          onPress={handleManualCreate}
          variant="secondary"
        />
      </ScrollView>
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
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  backButton: {
    paddingHorizontal: theme.spacing.md,
    minHeight: 40,
    width: 80,
  },
  headerTitle: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pasteButton: {
    marginLeft: theme.spacing.sm,
    width: 60,
    paddingHorizontal: 0,
  },
  extractButton: {
    marginBottom: theme.spacing.lg,
  },
  previewSection: {
    marginBottom: theme.spacing.lg,
  },
  previewLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  previewCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  previewTitle: {
    ...theme.typography.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  previewContentType: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  previewText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  saveButton: {
    marginBottom: theme.spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  dividerText: {
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
});
