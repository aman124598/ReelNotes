import { createClient } from '@supabase/supabase-js';
import { Note } from '../types';
import { normalizeText } from '../utils/text';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

const decodeJwtRole = (token?: string): string => {
  if (!token) return 'unknown';
  try {
    const parts = token.split('.');
    if (parts.length < 2) return 'unknown';
    const payload = parts[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));
    return String(decoded?.role || 'unknown');
  } catch {
    return 'unknown';
  }
};

const supabaseKeyRole = decodeJwtRole(supabaseKey);
const usingServiceRoleInClient = supabaseKeyRole === 'service_role';

// Fail gracefully if keys are missing to prevent immediate crash
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase keys are missing! Check your .env file.');
}

if (usingServiceRoleInClient) {
  console.error('EXPO_PUBLIC_SUPABASE_KEY is using service_role. Replace it with Supabase anon public key for client apps.');
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

const invokeEdgeFunction = async <T = any>(name: string, body: Record<string, unknown>): Promise<{ data?: T; error?: string }> => {
  if (!supabaseUrl || !supabaseKey) {
    return { error: 'Supabase keys missing' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    return { error: 'No user session. Enable Supabase Anonymous sign-ins and rebuild the app.' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        error: payload?.error || payload?.message || `Edge Function returned status ${response.status}`,
      };
    }

    return { data: payload as T };
  } catch (error: any) {
    return { error: error?.message || 'Failed to send a request to the Edge Function' };
  }
};

const isEdgeGatewayError = (error?: string): boolean => {
  if (!error) return false;
  const msg = error.toLowerCase();
  return msg.includes('status 502') || msg.includes('status 503') || msg.includes('status 504');
};

const enqueueReelDirect = async (url: string): Promise<{ reelId?: number; status?: Note['status']; error?: string }> => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    return { error: sessionError.message };
  }

  const ownerId = sessionData?.session?.user?.id;
  if (!ownerId) {
    return { error: 'No user session. Enable Supabase Anonymous sign-ins and rebuild the app.' };
  }

  const { data: newReel, error: reelInsertError } = await supabase
    .from('reels')
    .insert({
      owner_id: ownerId,
      url,
      title: 'Processing Reel',
      content_type: 'Recipe',
      structured_text: 'Processing speech and extracting recipe notes...',
      status: 'queued',
    })
    .select('id, status')
    .single();

  if (reelInsertError || !newReel) {
    return { error: reelInsertError?.message || 'Failed to create reel note' };
  }

  const { error: jobError } = await supabase
    .from('reel_jobs')
    .insert({ reel_id: newReel.id, status: 'queued', attempt_count: 0 });

  if (jobError) {
    await supabase.from('reels').delete().eq('id', newReel.id);
    return { error: jobError.message };
  }

  return { reelId: newReel.id, status: newReel.status as Note['status'] };
};

const retryReelDirect = async (reelId: number): Promise<{ status?: string; error?: string }> => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    return { error: sessionError.message };
  }

  const ownerId = sessionData?.session?.user?.id;
  if (!ownerId) {
    return { error: 'No user session. Enable Supabase Anonymous sign-ins and rebuild the app.' };
  }

  const { data: reel, error: reelError } = await supabase
    .from('reels')
    .select('id')
    .eq('id', reelId)
    .eq('owner_id', ownerId)
    .single();

  if (reelError || !reel) {
    return { error: 'Reel note not found' };
  }

  const { error: updateError } = await supabase
    .from('reels')
    .update({ status: 'queued', processing_error: null })
    .eq('id', reelId)
    .eq('owner_id', ownerId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { data: existingActiveJob, error: existingJobError } = await supabase
    .from('reel_jobs')
    .select('id')
    .eq('reel_id', reelId)
    .in('status', ['queued', 'processing'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingJobError) {
    return { error: existingJobError.message };
  }

  if (!existingActiveJob) {
    const { error: jobError } = await supabase
      .from('reel_jobs')
      .insert({ reel_id: reelId, status: 'queued', attempt_count: 0 });
    if (jobError) {
      return { error: jobError.message };
    }
  }

  return { status: 'queued' };
};

export const enqueueReel = async (url: string): Promise<{ reelId?: number; status?: Note['status']; error?: string }> => {
  try {
    if (usingServiceRoleInClient) {
      return {
        error: 'Client is using service_role key. Set EXPO_PUBLIC_SUPABASE_KEY to the Supabase anon public key and rebuild the app.',
      };
    }

    await ensureUserSession();

    const { data, error } = await invokeEdgeFunction<{ reelId?: number; status?: Note['status'] }>('enqueue-reel', { url });
    if (error) {
      if (isEdgeGatewayError(error)) {
        console.warn('Edge function gateway error during enqueue; falling back to direct DB enqueue.');
        return await enqueueReelDirect(url);
      }
      console.error('Supabase function error:', error);
      return { error };
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

    const { data, error } = await invokeEdgeFunction<{ status?: string }>('enqueue-reel', { reelId, retry: true });
    if (error) {
      if (isEdgeGatewayError(error)) {
        console.warn('Edge function gateway error during retry; falling back to direct DB retry.');
        return await retryReelDirect(reelId);
      }
      console.error('Retry function error:', error);
      return { error };
    }

    return { status: data?.status };
  } catch (err: any) {
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
