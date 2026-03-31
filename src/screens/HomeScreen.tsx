import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Animated, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NoteCard } from '../components/NoteCard';
import { SearchBar } from '../components/SearchBar';
import { Button } from '../components/Button';
import { ScreenBackdrop } from '../components/ScreenBackdrop';

import { getNotesPage, searchNotesPage, deleteNote, syncNotesFromServer } from '../services/supabase';
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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Note>>(null);
  const updateScrollTopVisibility = useCallback((yOffset: number) => {
    setShowScrollTop(yOffset > 360);
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const loadNotes = async (reset = false) => {
    const nextPage = reset ? 0 : currentPage;

    if (reset) {
      if (loading) return;
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
      scrollToTop(false);
      setShowScrollTop(false);
      setCurrentPage(0);
      setHasMore(true);
      setNotes([]);
      loadNotes(true);
    }, [searchQuery])
  );

  const handleDeleteNote = (id: number) => {
    const runDelete = async () => {
      const success = await deleteNote(id);
      if (success) {
        scrollToTop(false);
        setShowScrollTop(false);
        setCurrentPage(0);
        setHasMore(true);
        setNotes([]);
        loadNotes(true);
      } else {
        Alert.alert('Error', 'Failed to delete note');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm('Are you sure you want to delete this note?');
      if (confirmed) {
        runDelete();
      }
      return;
    }

    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: runDelete,
      },
    ]);
  };

  const handleRefresh = async () => {
    if (loading || loadingMore) return;

    setLoading(true);
    try {
      await syncNotesFromServer();

      let batch: { notes: Note[]; hasMore: boolean };
      if (searchQuery.trim()) {
        batch = await searchNotesPage(searchQuery.trim(), 0, PAGE_SIZE);
      } else {
        batch = await getNotesPage(0, PAGE_SIZE);
      }

      scrollToTop(false);
      setShowScrollTop(false);
      setCurrentPage(1);
      setHasMore(batch.hasMore);
      setNotes(batch.notes);
    } catch (error) {
      console.error('Error refreshing notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const noteCount = notes.length;
  const isListEmpty = noteCount === 0;
  const processingCount = notes.filter((note) => note.status === 'queued' || note.status === 'processing').length;
  const failedCount = notes.filter((note) => note.status === 'failed').length;
  const readyCount = notes.filter((note) => note.status === 'ready').length;

  const scrollToTop = (animated: boolean) => {
    listRef.current?.scrollToOffset({ offset: 0, animated });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackdrop />

      <Animated.View style={[styles.listWrapper, { opacity: fadeAnim }]}>
        <FlatList
          ref={listRef}
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
          contentContainerStyle={isListEmpty ? styles.listContentEmpty : styles.listContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          scrollEnabled
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            updateScrollTopVisibility(y);
          }}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View>
              <View style={styles.heroCard}>
                <Text style={styles.appBrand}>ReelNotes</Text>
                <Text style={styles.title}>Recipe Notes</Text>
                <Text style={styles.subtitle}>
                  Capture reel insights with a calm workspace, quick extraction, and compact cards made for one-handed use.
                </Text>
                <View style={styles.heroActionRow}>
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{noteCount} saved</Text>
                  </View>
                  <Button
                    title="Add New Note"
                    variant="primary"
                    style={styles.addNewButton}
                    onPress={() => navigation.navigate('AddNote')}
                  />
                </View>
              </View>

              <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search titles, tags, or notes" />

              <View style={styles.statGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{readyCount}</Text>
                  <Text style={styles.statLabel}>Ready</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{processingCount}</Text>
                  <Text style={styles.statLabel}>Processing</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{failedCount}</Text>
                  <Text style={styles.statLabel}>Failed</Text>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Library</Text>
                <View style={styles.sectionActions}>
                  <Text style={styles.sectionMeta}>{loading ? 'Refreshing' : `${noteCount} total`}</Text>
                  <Button
                    title={loading ? 'Refreshing...' : 'Refresh'}
                    onPress={handleRefresh}
                    variant="secondary"
                    style={styles.refreshButton}
                    loading={loading}
                  />
                </View>
              </View>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footerArea}>
              {loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={styles.footerLoaderText}>Loading more notes...</Text>
                </View>
              ) : null}

              {!loading && !loadingMore && hasMore && !isListEmpty ? (
                <View style={styles.loadMoreWrap}>
                  <Button title="Load More Recipes" onPress={() => loadNotes(false)} />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No notes yet</Text>
                <Text style={styles.emptySubtext}>Start with a reel URL or write your own manual note in seconds.</Text>
                <Button title="Create Your First Note" onPress={() => navigation.navigate('AddNote')} />
              </View>
            </View>
          }
        />
      </Animated.View>

      {showScrollTop ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Scroll to top"
          style={styles.scrollTopButton}
          onPress={() => scrollToTop(true)}
        >
          <Text style={styles.scrollTopButtonText}>↑</Text>
        </TouchableOpacity>
      ) : null}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listWrapper: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    paddingBottom: 120,
  },
  listContentEmpty: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    paddingBottom: 120,
    flexGrow: 1,
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    marginBottom: theme.spacing.lg,
  },
  appBrand: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  heroActionRow: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  addNewButton: {
    minHeight: 40,
    paddingVertical: 8,
  },
  countPill: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    paddingVertical: 7,
    paddingHorizontal: theme.spacing.md,
  },
  countText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    width: '31%',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  statValue: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  sectionMeta: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  refreshButton: {
    minHeight: 34,
    paddingVertical: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: theme.spacing.md,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    padding: theme.spacing.lg,
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
  footerLoader: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  footerArea: {
    paddingBottom: theme.spacing.sm,
  },
  footerLoaderText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    marginTop: 4,
  },
  loadMoreWrap: {
    paddingTop: theme.spacing.sm,
  },
  scrollTopButton: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.soft,
  },
  scrollTopButtonText: {
    ...theme.typography.title,
    color: theme.colors.text,
    lineHeight: 20,
  },
});
