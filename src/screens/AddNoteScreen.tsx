import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Button } from '../components/Button';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { addNote } from '../services/supabase';
import { enqueueReel } from '../services/supabase';
import { theme } from '../theme';

export const AddNoteScreen = ({ navigation }: any) => {
  const [url, setUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualBody, setManualBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handlePasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
    }
  };

  const validateInstagramUrl = (value: string): boolean => {
    const patterns = [
      /instagram\.com\/reel\/[A-Za-z0-9_-]+/,
      /instagram\.com\/p\/[A-Za-z0-9_-]+/,
      /instagram\.com\/tv\/[A-Za-z0-9_-]+/,
    ];
    return patterns.some((pattern) => pattern.test(value));
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
      const { reelId, error } = await enqueueReel(url.trim());
      if (error || !reelId) {
        Alert.alert('Queue Error', error || 'Failed to queue reel processing');
        setLoading(false);
        return;
      }

      navigation.replace('NoteDetail', { noteId: reelId });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to queue reel processing');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCreate = async () => {
    const cleanTitle = manualTitle.trim();
    const cleanBody = manualBody.trim();

    if (!cleanBody) {
      Alert.alert('Manual Note', 'Please add note content before saving.');
      return;
    }

    setManualSaving(true);
    const noteId = await addNote({
      url: 'Manual Entry',
      title: cleanTitle || cleanBody.split('\n')[0].slice(0, 60) || 'Untitled Note',
      content_type: 'Other',
      structured_text: cleanBody,
      status: 'ready',
    });

    if (noteId) {
      navigation.replace('NoteDetail', { noteId });
    } else {
      Alert.alert('Error', 'Failed to create note');
    }

    setManualSaving(false);
  };

  const bringManualSectionIntoView = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackdrop />

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
          <View style={styles.header}>
            <Button title="Back" onPress={() => navigation.goBack()} variant="ghost" style={styles.backButton} />
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerEyebrow}>NEW CAPTURE</Text>
              <Text style={styles.headerTitle}>Add A Note</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Instagram Reel Link</Text>
              <Text style={styles.sectionDescription}>Paste any reel, post, or IGTV URL and let ReelNotes extract the essentials.</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.linkInput}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://www.instagram.com/reel/..."
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  textContentType="URL"
                  autoComplete="url"
                  returnKeyType="go"
                />
                <Button title="Paste" onPress={handlePasteFromClipboard} variant="secondary" style={styles.pasteButton} />
              </View>
              <Button title={loading ? 'Queueing...' : 'Extract From Reel'} onPress={handleExtract} loading={loading} />
            </View>

            <View style={styles.separatorWrap}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OR WRITE IT MANUALLY</Text>
              <View style={styles.separatorLine} />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Manual Note</Text>
              <TextInput
                style={[styles.input, styles.fieldSpacing]}
                value={manualTitle}
                onChangeText={setManualTitle}
                placeholder="Title"
                placeholderTextColor={theme.colors.textMuted}
                onFocus={bringManualSectionIntoView}
              />
              <TextInput
                style={styles.textArea}
                value={manualBody}
                onChangeText={setManualBody}
                placeholder="Write your recipe notes here..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                textAlignVertical="top"
                onFocus={bringManualSectionIntoView}
              />
              <Button
                title={manualSaving ? 'Saving...' : 'Create Manual Note'}
                onPress={handleManualCreate}
                variant="secondary"
                loading={manualSaving}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardWrapper: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    minWidth: 76,
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  headerEyebrow: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    letterSpacing: 1,
  },
  headerTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 72,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.heading,
    color: theme.colors.text,
    marginBottom: 6,
  },
  sectionDescription: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: theme.spacing.md,
  },
  linkInput: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  input: {
    flex: 1,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  fieldSpacing: {
    marginBottom: theme.spacing.md,
  },
  pasteButton: {
    marginLeft: theme.spacing.sm,
    minWidth: 84,
    alignSelf: 'stretch',
  },
  textArea: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.colors.text,
    ...theme.typography.body,
    minHeight: 170,
    marginBottom: theme.spacing.md,
  },
  separatorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  separatorText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    paddingHorizontal: theme.spacing.sm,
    letterSpacing: 0.7,
  },
});
