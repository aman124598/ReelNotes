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
          <Button
            title="Back"
            onPress={() => navigation.goBack()}
            variant="ghost"
            style={styles.backButton}
          />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>New Note</Text>
            <Text style={styles.headerSubtitle}>Paste a reel and save only key recipe notes.</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
            title={loading ? 'Queueing...' : 'Process Reel'}
            onPress={handleExtract}
            loading={loading}
            style={styles.extractButton}
          />
          <Text style={styles.processingText}>
            We will save the reel immediately and extract recipe notes in the background.
          </Text>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>MANUAL</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={manualTitle}
              onChangeText={setManualTitle}
              placeholder="Quick title for your note"
              placeholderTextColor={theme.colors.textMuted}
              onFocus={bringManualSectionIntoView}
            />
            <Text style={[styles.label, styles.manualContentLabel]}>Content</Text>
            <TextInput
              style={styles.manualInput}
              value={manualBody}
              onChangeText={setManualBody}
              placeholder="Write your note manually..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              textAlignVertical="top"
              onFocus={bringManualSectionIntoView}
            />
          </View>

          <Button
            title={manualSaving ? 'Saving...' : 'Create Manual Note'}
            onPress={handleManualCreate}
            variant="secondary"
            loading={manualSaving}
          />
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
    minHeight: 0,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    flexGrow: 1,
  },
  section: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    ...theme.shadows.soft,
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
    backgroundColor: theme.colors.backgroundAlt,
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
  processingText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
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
  manualContentLabel: {
    marginTop: theme.spacing.md,
  },
  manualInput: {
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    color: theme.colors.text,
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    minHeight: 140,
  },
});
