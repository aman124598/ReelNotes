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
import * as Clipboard from 'expo-clipboard';
import { Button } from '../components/Button';
import { addNote } from '../services/supabase';
import { extractReelContent } from '../services/supabase';
import { formatWithGroq } from '../services/groq';
import { theme } from '../theme';
import { normalizeText } from '../utils/text';

export const AddNoteScreen = ({ navigation }: any) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [extractedData, setExtractedData] = useState<{
    title: string;
    contentType: string;
    structuredText: string;
    transcript?: string;
  } | null>(null);

  const previewTitle = extractedData ? normalizeText(extractedData.title, 'Untitled Note') : '';
  const previewContentType = extractedData ? normalizeText(extractedData.contentType, 'Other') : '';
  const previewText = extractedData ? normalizeText(extractedData.structuredText, '') : '';

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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

  const handleSave = async () => {
    if (!extractedData) {
      Alert.alert('Error', 'Please extract content first');
      return;
    }

    const noteId = await addNote({
      url: url.trim(),
      title: previewTitle || 'Untitled Note',
      content_type: previewContentType || 'Other',
      structured_text: previewText,
      raw_transcript: extractedData.transcript,
      status: 'ready',
    });

    if (noteId) {
      Alert.alert('Success', 'Note saved!', [
        {
          text: 'OK',
          onPress: () => navigation.replace('NoteDetail', { noteId }),
        },
      ]);
    } else {
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const handleManualCreate = async () => {
    const noteId = await addNote({
      url: url.trim() || 'Manual Entry',
      title: 'Untitled Note',
      content_type: 'Other',
      structured_text: '',
      status: 'draft',
    });

    if (noteId) {
      navigation.replace('NoteDetail', { noteId });
    } else {
      Alert.alert('Error', 'Failed to create note');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.background}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
      </View>

      <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Button
            title="Back"
            onPress={() => navigation.goBack()}
            variant="ghost"
            style={styles.backButton}
          />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>New Note</Text>
            <Text style={styles.headerSubtitle}>Extract a reel and save the highlights.</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.label}>Instagram Link</Text>
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
                title="Paste"
                onPress={handlePasteFromClipboard}
                variant="secondary"
                style={styles.pasteButton}
              />
            </View>
            <Text style={styles.helperText}>We support reels, posts, and IGTV links.</Text>
          </View>

          <Button
            title={loading ? 'Extracting...' : 'Extract Content'}
            onPress={handleExtract}
            loading={loading}
            style={styles.extractButton}
          />

          {extractedData && (
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Preview</Text>

              <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>{previewTitle}</Text>
              <Text style={styles.previewContentType}>{previewContentType}</Text>
              <Text style={styles.previewText} numberOfLines={10}>
                {previewText}
              </Text>
            </View>

              <Button title="Save Note" onPress={handleSave} style={styles.saveButton} />
            </View>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title="Create Manual Note"
            onPress={handleManualCreate}
            variant="secondary"
          />
        </ScrollView>
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
    width: 300,
    height: 300,
    borderRadius: 150,
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
    bottom: -200,
    left: -140,
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    paddingHorizontal: theme.spacing.md,
    minHeight: 36,
  },
  headerText: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  headerSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    color: theme.colors.text,
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  pasteButton: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minWidth: 80,
  },
  helperText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
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
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewCard: {
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    ...theme.shadows.soft,
  },
  previewTitle: {
    ...theme.typography.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  previewContentType: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderSoft,
    opacity: 0.7,
  },
  dividerText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    paddingHorizontal: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
