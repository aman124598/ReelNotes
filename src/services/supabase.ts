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

let authInitPromise: Promise<void> | null = null;

const ensureUserSession = async (): Promise<void> => {
  if (!supabaseUrl || !supabaseKey) return;
  if (authInitPromise) {
    await authInitPromise;
    return;
  }

  authInitPromise = (async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Error checking auth session:', sessionError);
      return;
    }

    if (sessionData?.session) return;

    const { error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) {
      console.error('Anonymous sign-in failed:', anonError);
    }
  })();

  try {
    await authInitPromise;
  } finally {
    authInitPromise = null;
  }
};

const normalizeNote = (note: any): Note => ({
  ...note,
  title: normalizeText(note?.title, 'Untitled Note'),
  content_type: normalizeText(note?.content_type, 'Recipe'),
  structured_text: normalizeText(note?.structured_text, ''),
  status: normalizeText(note?.status, 'queued') as Note['status'],
});

const hasMeaningfulText = (value: unknown): boolean => normalizeText(value, '').trim().length > 0;
const PROCESSING_PLACEHOLDER_TEXT = 'processing speech and extracting recipe notes...';

const shouldHideProcessedEmptyNote = (note: Note): boolean => {
  if (note.status !== 'ready') return false;

  const structuredText = normalizeText(note.structured_text, '').trim();
  const title = normalizeText(note.title, '').trim().toLowerCase();
  const processingPlaceholder = structuredText.toLowerCase() === PROCESSING_PLACEHOLDER_TEXT;
  const noUsableInfo = !hasMeaningfulText(structuredText);
  const noSourceData = !hasMeaningfulText(note.raw_transcript) && !hasMeaningfulText(note.raw_ocr) && !hasMeaningfulText(note.source_transcript);
  const stillGenericTitle = title === 'processing reel';

  return noUsableInfo || (processingPlaceholder && noSourceData) || (stillGenericTitle && noSourceData);
};

const toVisibleNotes = (rows: any[] | null | undefined): Note[] =>
  (rows || []).map(normalizeNote).filter((note) => !shouldHideProcessedEmptyNote(note));

export const enqueueReel = async (url: string): Promise<{ reelId?: number; status?: Note['status']; error?: string }> => {
  try {
    await ensureUserSession();

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
    await ensureUserSession();

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
  await ensureUserSession();

  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    return [];
  }

  return toVisibleNotes(data);
};

export const getNotesPage = async (page: number, pageSize: number): Promise<{ notes: Note[]; hasMore: boolean }> => {
  await ensureUserSession();

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

  const notes = toVisibleNotes(data);
  return { notes, hasMore: (data || []).length === pageSize };
};

export const getNoteById = async (id: number): Promise<Note | null> => {
  await ensureUserSession();

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
  await ensureUserSession();

  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .or(`title.ilike.%${query}%,structured_text.ilike.%${query}%`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error searching notes:', error);
    return [];
  }

  return toVisibleNotes(data);
};

export const searchNotesPage = async (query: string, page: number, pageSize: number): Promise<{ notes: Note[]; hasMore: boolean }> => {
  await ensureUserSession();

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

  const notes = toVisibleNotes(data);
  return { notes, hasMore: (data || []).length === pageSize };
};

export const addNote = async (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<number | null> => {
  await ensureUserSession();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    console.error('Unable to resolve current user for note insert:', userError);
    return null;
  }

  const normalizedStructuredText = normalizeText(note.structured_text, '');
  const normalizedStatus = normalizeText(note.status, 'queued');

  // Do not allow saving an empty note as ready.
  if (normalizedStatus === 'ready' && !hasMeaningfulText(normalizedStructuredText)) {
    console.warn('Skipping addNote: ready note has empty content.');
    return null;
  }

  const payload = {
    ...note,
    owner_id: userData.user.id,
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
  await ensureUserSession();

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
  await ensureUserSession();

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
  await ensureUserSession();

  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('content_type', contentType)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes by type:', error);
    return [];
  }

  return toVisibleNotes(data);
};
