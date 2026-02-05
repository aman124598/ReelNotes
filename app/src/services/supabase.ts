import { createClient } from '@supabase/supabase-js';
import { Note } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const extractReelContent = async (url: string): Promise<{ transcript?: string; ocr?: string; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('extract-reel', {
      body: { url },
    });

    if (error) {
      console.error('Supabase function error:', error);
      return { error: error.message };
    }

    return data;
  } catch (err: any) {
    console.error('Extract reel error:', err);
    return { error: err.message || 'Failed to extract reel content' };
  }
};

// Database operations using Supabase
export const getAllNotes = async (): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    return [];
  }

  return data || [];
};

export const getNoteById = async (id: number): Promise<Note | null> => {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching note:', error);
    return null;
  }

  return data;
};

export const searchNotes = async (query: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .or(`title.ilike.%${query}%,structured_text.ilike.%${query}%`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error searching notes:', error);
    return [];
  }

  return data || [];
};

export const addNote = async (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<number | null> => {
  const { data, error } = await supabase
    .from('reels')
    .insert([note])
    .select('id')
    .single();

  if (error) {
    console.error('Error adding note:', error);
    return null;
  }

  return data?.id || null;
};

export const updateNote = async (id: number, updates: Partial<Note>): Promise<boolean> => {
  const { error } = await supabase
    .from('reels')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error updating note:', error);
    return false;
  }

  return true;
};

export const deleteNote = async (id: number): Promise<boolean> => {
  const { error } = await supabase
    .from('reels')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting note:', error);
    return false;
  }

  return true;
};

export const getNotesByContentType = async (contentType: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('content_type', contentType)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes by type:', error);
    return [];
  }

  return data || [];
};
