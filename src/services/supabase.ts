import { createClient } from '@supabase/supabase-js';
import { Note } from '../types';
import { normalizeText } from '../utils/text';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

// Fail gracefully if keys are missing to prevent immediate crash
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase keys are missing! Check your .env file.');
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  // Create a mock client or throw a handled error when used, rather than crashing on init
  : {
      from: () => ({ select: () => ({ data: [], error: { message: 'Supabase keys missing' } }) }),
      functions: { invoke: async () => ({ error: { message: 'Supabase keys missing' } }) }
    } as any;

const normalizeNote = (note: any): Note => ({
  ...note,
  title: normalizeText(note?.title, 'Untitled Note'),
  content_type: normalizeText(note?.content_type, 'Recipe'),
  structured_text: normalizeText(note?.structured_text, ''),
  status: normalizeText(note?.status, 'queued') as Note['status'],
});

const hasMeaningfulText = (value: unknown): boolean => normalizeText(value, '').trim().length > 0;

export const enqueueReel = async (url: string): Promise<{ reelId?: number; status?: Note['status']; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('enqueue-reel', {
      body: { url },
    });

    if (error) {
      console.error('Supabase function error:', error);
      return { error: error.message };
    }

    return {
      reelId: data?.reelId,
      status: data?.status,
    };
  } catch (err: any) {
    if (err?.name === 'FunctionsHttpError' && err?.context) {
      try {
        const body = await err.context.json();
        console.error('Enqueue reel HTTP error body:', body);
        return { error: body?.error || 'Edge Function returned an HTTP error' };
      } catch (_parseErr) {
        console.error('Enqueue reel HTTP error (unparsed body):', err);
      }
    }
    console.error('Enqueue reel error:', err);
    return { error: err.message || 'Failed to queue reel processing' };
  }
};

export const retryReelProcessing = async (reelId: number): Promise<{ status?: string; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('enqueue-reel', {
      body: { reelId, retry: true },
    });

    if (error) {
      console.error('Retry function error:', error);
      return { error: error.message };
    }

    return { status: data?.status };
  } catch (err: any) {
    if (err?.name === 'FunctionsHttpError' && err?.context) {
      try {
        const body = await err.context.json();
        console.error('Retry reel HTTP error body:', body);
        return { error: body?.error || 'Edge Function returned an HTTP error' };
      } catch (_parseErr) {
        console.error('Retry reel HTTP error (unparsed body):', err);
      }
    }
    console.error('Retry reel error:', err);
    return { error: err.message || 'Failed to retry reel processing' };
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

  return (data || []).map(normalizeNote);
};

export const getNotesPage = async (page: number, pageSize: number): Promise<{ notes: Note[]; hasMore: boolean }> => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching notes page:', error);
    return { notes: [], hasMore: false };
  }

  const notes = (data || []).map(normalizeNote);
  return { notes, hasMore: notes.length === pageSize };
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

  return data ? normalizeNote(data) : null;
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

  return (data || []).map(normalizeNote);
};

export const searchNotesPage = async (query: string, page: number, pageSize: number): Promise<{ notes: Note[]; hasMore: boolean }> => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .or(`title.ilike.%${query}%,structured_text.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error searching notes page:', error);
    return { notes: [], hasMore: false };
  }

  const notes = (data || []).map(normalizeNote);
  return { notes, hasMore: notes.length === pageSize };
};

export const addNote = async (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<number | null> => {
  const normalizedStructuredText = normalizeText(note.structured_text, '');
  const normalizedStatus = normalizeText(note.status, 'queued');

  // Do not allow saving an empty note as ready.
  if (normalizedStatus === 'ready' && !hasMeaningfulText(normalizedStructuredText)) {
    console.warn('Skipping addNote: ready note has empty content.');
    return null;
  }

  const payload = {
    ...note,
    title: normalizeText(note.title, 'Untitled Note'),
    content_type: normalizeText(note.content_type, 'Recipe'),
    structured_text: normalizedStructuredText,
    status: normalizedStatus,
  };

  const { data, error } = await supabase
    .from('reels')
    .insert([payload])
    .select('id')
    .single();

  if (error) {
    console.error('Error adding note:', error);
    return null;
  }

  return data?.id || null;
};

export const updateNote = async (id: number, updates: Partial<Note>): Promise<boolean> => {
  const normalizedUpdates: Partial<Note> = { ...updates };

  if ('structured_text' in updates) {
    const nextStructuredText = normalizeText(updates.structured_text, '');
    if (!hasMeaningfulText(nextStructuredText)) {
      console.warn('Skipping updateNote: empty content is not allowed.');
      return false;
    }
    normalizedUpdates.structured_text = nextStructuredText;
  }

  if ('title' in updates) {
    normalizedUpdates.title = normalizeText(updates.title, 'Untitled Note');
  }

  if ('content_type' in updates) {
    normalizedUpdates.content_type = normalizeText(updates.content_type, 'Other');
  }

  const { error } = await supabase
    .from('reels')
    .update({ ...normalizedUpdates, updated_at: new Date().toISOString() })
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

  return (data || []).map(normalizeNote);
};
