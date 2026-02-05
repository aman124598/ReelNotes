import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NoteCard } from '../components/NoteCard';
import { SearchBar } from '../components/SearchBar';
import { Button } from '../components/Button';
import { getAllNotes, searchNotes, deleteNote } from '../services/supabase';
import { Note } from '../types';
import { theme } from '../theme';

export const HomeScreen = ({ navigation }: any) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const results = await searchNotes(searchQuery);
        setNotes(results);
      } else {
        const results = await getAllNotes();
        setNotes(results);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotes();
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
              loadNotes();
            } else {
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const noteCount = notes.length;

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.background}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
        <View style={styles.ring} />
      </View>

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
          ListHeaderComponent={
            <View>
              <View style={styles.hero}>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Reel</Text>
                  </View>
                  <View style={styles.badgeDot} />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Notes</Text>
                  </View>
                </View>

                <Text style={styles.title}>ReelNotes</Text>
                <Text style={styles.subtitle}>
                  Turn reels into sharp, searchable notes for your personal library.
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

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Library</Text>
              <Text style={styles.sectionMeta}>{loading ? 'Updating...' : `${noteCount} total`}</Text>
              </View>
            </View>
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
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  glowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.colors.primarySoft,
    top: -140,
    right: -100,
    opacity: 0.9,
  },
  glowBottom: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: theme.colors.accentSoft,
    bottom: -200,
    left: -140,
    opacity: 0.8,
  },
  ring: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    top: 120,
    left: -60,
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  badge: {
    backgroundColor: theme.colors.cardElevated,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  badgeText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginHorizontal: theme.spacing.sm,
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
});
