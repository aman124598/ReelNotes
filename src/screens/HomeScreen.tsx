import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NoteCard } from '../components/NoteCard';
import { SearchBar } from '../components/SearchBar';
import { Button } from '../components/Button';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { getNotesPage, searchNotesPage, deleteNote } from '../services/supabase';
import { Note } from '../types';
import { theme } from '../theme';

export const HomeScreen = ({ navigation }: any) => {
  const PAGE_SIZE = 20;
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const loadNotes = async (reset = false) => {
    const nextPage = reset ? 0 : currentPage;

    if (reset) {
      setLoading(true);
    } else {
      if (loading || loadingMore || !hasMore) return;
      setLoadingMore(true);
    }

    try {
      let batch: { notes: Note[]; hasMore: boolean };
      if (searchQuery.trim()) {
        batch = await searchNotesPage(searchQuery.trim(), nextPage, PAGE_SIZE);
      } else {
        batch = await getNotesPage(nextPage, PAGE_SIZE);
      }

      setHasMore(batch.hasMore);
      setCurrentPage(nextPage + 1);
      setNotes((prev) => (reset ? batch.notes : [...prev, ...batch.notes]));
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      setCurrentPage(0);
      setHasMore(true);
      setNotes([]);
      loadNotes(true);
    }, [searchQuery])
  );

  const handleDeleteNote = (id: number) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteNote(id);
              if (success) {
                setCurrentPage(0);
                setHasMore(true);
                setNotes([]);
                loadNotes(true);
              } else {
                Alert.alert('Error', 'Failed to delete note');
              }
          },
        },
      ]
    );
  };

  const noteCount = notes.length;
  const processingCount = notes.filter((note) => note.status === 'queued' || note.status === 'processing').length;
  const failedCount = notes.filter((note) => note.status === 'failed').length;
  const readyCount = notes.filter((note) => note.status === 'ready').length;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackdrop />

      <Animated.View style={[styles.listWrapper, { opacity: fadeAnim }]}>
        <FlatList
          data={notes}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => navigation.navigate('NoteDetail', { noteId: item.id })}
              onDelete={() => handleDeleteNote(item.id)}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => loadNotes(false)}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View>
              <View style={styles.hero}>
                <View style={styles.profileRow}>
                  <View style={styles.profileBadge}>
                    <Text style={styles.profileInitials}>RN</Text>
                  </View>
                  <View style={styles.profileTextWrap}>
                    <Text style={styles.profileName}>ReelNotes</Text>
                    <Text style={styles.profileRole}>Recipe extraction workspace</Text>
                  </View>
                </View>

                <Text style={styles.title}>Your Notes</Text>
                <Text style={styles.subtitle}>
                  Keep short, structured recipe notes from reels in one calm workspace.
                </Text>

                <View style={styles.actionsRow}>
                  <Button
                    title="New Note"
                    onPress={() => navigation.navigate('AddNote')}
                    style={styles.newButton}
                  />
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>
                      {noteCount} {noteCount === 1 ? 'note' : 'notes'}
                    </Text>
                  </View>
                </View>
              </View>

              <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

              <View style={styles.statRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>Ready</Text>
                  <Text style={styles.statValue}>{readyCount}</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>Processing</Text>
                  <Text style={styles.statValue}>{processingCount}</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>Failed</Text>
                  <Text style={styles.statValue}>{failedCount}</Text>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Library</Text>
              <Text style={styles.sectionMeta}>{loading ? 'Updating...' : `${noteCount} total`}</Text>
              </View>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={styles.footerLoaderText}>Loading more notes...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No notes yet</Text>
                <Text style={styles.emptySubtext}>
                  Paste a reel link to extract highlights, then save your first note.
                </Text>
                <Button
                  title="Create First Note"
                  variant="secondary"
                  onPress={() => navigation.navigate('AddNote')}
                  style={styles.emptyButton}
                />
              </View>
            </View>
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    flexGrow: 1,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listWrapper: {
    flex: 1,
    minHeight: 0,
  },
  hero: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  profileInitials: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    letterSpacing: 0.6,
  },
  profileTextWrap: {
    marginLeft: theme.spacing.sm,
  },
  profileName: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  profileRole: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    maxWidth: 320,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  newButton: {
    marginRight: theme.spacing.sm,
  },
  countPill: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 999,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  countText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statPill: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.borderSoft,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    marginRight: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    marginRight: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    ...theme.typography.caption,
    color: theme.colors.text,
  },
  sectionTitle: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  sectionMeta: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  emptyState: {
    paddingVertical: theme.spacing.xl,
  },
  emptyCard: {
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    ...theme.shadows.soft,
  },
  emptyTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  emptyButton: {
    alignSelf: 'flex-start',
  },
  footerLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
  },
  footerLoaderText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    marginTop: theme.spacing.xs,
  },
});
