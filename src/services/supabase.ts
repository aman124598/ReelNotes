import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const NOTES_CACHE_KEY = 'reelnotes.notes.v1';
const EDGE_FUNCTION_TIMEOUT_MS = 45000;

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

    if (sessionData?.session) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError && userData?.user?.id) return;

      console.warn('Existing Supabase session is invalid; refreshing anonymous auth session.');
      await resetAnonymousSession();
      return;
    }

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

const resetAnonymousSession = async (): Promise<void> => {
  if (!supabaseUrl || !supabaseKey) return;

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.warn('Failed to clear stale auth session:', signOutError.message);
  }

  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    console.error('Anonymous re-auth failed:', signInError);
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

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const sortNotesByCreatedAtDesc = (notes: Note[]): Note[] =>
  [...notes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

const readCachedNotes = async (): Promise<Note[]> => {
  try {
    const raw = await AsyncStorage.getItem(NOTES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortNotesByCreatedAtDesc(parsed.map(normalizeNote));
  } catch (error) {
    console.error('Failed to read cached notes:', error);
    return [];
  }
};

const writeCachedNotes = async (notes: Note[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(sortNotesByCreatedAtDesc(notes)));
  } catch (error) {
    console.error('Failed to write cached notes:', error);
  }
};

const upsertCachedNote = async (note: Note): Promise<void> => {
  const current = await readCachedNotes();
  const next = current.filter((existing) => existing.id !== note.id);
  next.push(normalizeNote(note));
  await writeCachedNotes(next);
};

const updateCachedNoteById = async (id: number, updates: Partial<Note>): Promise<boolean> => {
  const current = await readCachedNotes();
  const index = current.findIndex((note) => note.id === id);
  if (index < 0) return false;

  const nowIso = new Date().toISOString();
  current[index] = normalizeNote({
    ...current[index],
    ...updates,
    updated_at: nowIso,
  });

  await writeCachedNotes(current);
  return true;
};

const removeCachedNoteById = async (id: number): Promise<boolean> => {
  const current = await readCachedNotes();
  const next = current.filter((note) => note.id !== id);
  if (next.length === current.length) return false;
  await writeCachedNotes(next);
  return true;
};

const getCachedNotesPage = async (page: number, pageSize: number): Promise<{ notes: Note[]; hasMore: boolean }> => {
  const notes = await readCachedNotes();
  const from = page * pageSize;
  const toExclusive = from + pageSize;
  const batch = notes.slice(from, toExclusive);
  return { notes: batch, hasMore: toExclusive < notes.length };
};

const getCachedSearchPage = async (query: string, page: number, pageSize: number): Promise<{ notes: Note[]; hasMore: boolean }> => {
  const normalizedQuery = query.trim().toLowerCase();
  const notes = await readCachedNotes();
  const filtered = notes.filter((note) => {
    const title = normalizeText(note.title, '').toLowerCase();
    const structured = normalizeText(note.structured_text, '').toLowerCase();
    return title.includes(normalizedQuery) || structured.includes(normalizedQuery);
  });

  const from = page * pageSize;
  const toExclusive = from + pageSize;
  const batch = filtered.slice(from, toExclusive);
  return { notes: batch, hasMore: toExclusive < filtered.length };
};

const createLocalNoteId = (): number => -Date.now();

const mergeServerAndLocalNotes = (serverNotes: Note[], localNotes: Note[]): Note[] => {
  const serverIds = new Set(serverNotes.map((note) => note.id));
  const localOnlyNotes = localNotes.filter((note) => !serverIds.has(note.id));
  return sortNotesByCreatedAtDesc([...serverNotes, ...localOnlyNotes]);
};

export const syncNotesFromServer = async (): Promise<{ notes: Note[]; error?: string }> => {
  const localNotes = await readCachedNotes();
  await ensureUserSession();

  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error syncing notes from server:', error);
    return { notes: localNotes, error: error.message };
  }

  const serverNotes = toVisibleNotes(data);
  const mergedNotes = mergeServerAndLocalNotes(serverNotes, localNotes);
  await writeCachedNotes(mergedNotes);
  return { notes: mergedNotes };
};

const invokeEdgeFunction = async <T = any>(name: string, body: Record<string, unknown>): Promise<{ data?: T; error?: string }> => {
  if (!supabaseUrl || !supabaseKey) {
    return { error: 'Supabase keys missing' };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      if (attempt === 0) {
        await resetAnonymousSession();
        continue;
      }
      return { error: 'No user session. Enable Supabase Anonymous sign-ins and rebuild the app.' };
    }

    try {
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      }, EDGE_FUNCTION_TIMEOUT_MS);

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorMessage = payload?.error || payload?.message || `Edge Function returned status ${response.status}`;
        const isJwtError = response.status === 401
          || (typeof errorMessage === 'string' && /invalid jwt|jwt expired|jwt malformed/i.test(errorMessage));

        if (attempt === 0 && isJwtError) {
          await resetAnonymousSession();
          continue;
        }

        return { error: errorMessage };
      }

      return { data: payload as T };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return { error: `Edge Function timed out after ${Math.round(EDGE_FUNCTION_TIMEOUT_MS / 1000)}s` };
      }
      if (attempt === 0) {
        continue;
      }
      return { error: error?.message || 'Failed to send a request to the Edge Function' };
    }
  }

  return { error: 'Failed to send a request to the Edge Function' };
};

const isEdgeGatewayError = (error?: string): boolean => {
  if (!error) return false;
  const msg = error.toLowerCase();
  return msg.includes('status 502') || msg.includes('status 503') || msg.includes('status 504');
};

const isAuthJwtError = (error?: string): boolean => {
  if (!error) return false;
  const msg = error.toLowerCase();
  return msg.includes('invalid jwt') || msg.includes('jwt expired') || msg.includes('jwt malformed') || msg.includes('status 401');
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
      if (isEdgeGatewayError(error) || isAuthJwtError(error)) {
        console.warn('Edge function enqueue failed (gateway/auth); falling back to direct DB enqueue.');
        const fallback = await enqueueReelDirect(url);
        if (fallback.reelId) {
          const now = new Date().toISOString();
          await upsertCachedNote({
            id: fallback.reelId,
            url,
            title: 'Processing Reel',
            content_type: 'Recipe',
            structured_text: 'Processing speech and extracting recipe notes...',
            status: fallback.status || 'queued',
            created_at: now,
            updated_at: now,
          });
        }
        return fallback;
      }
      console.error('Supabase function error:', error);
      return { error };
    }

    const reelId = data?.reelId;
    const status = data?.status || 'queued';

    if (reelId) {
      const now = new Date().toISOString();
      await upsertCachedNote({
        id: reelId,
        url,
        title: 'Processing Reel',
        content_type: 'Recipe',
        structured_text: 'Processing speech and extracting recipe notes...',
        status,
        created_at: now,
        updated_at: now,
      });
    }

    return {
      reelId,
      status,
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
      if (isEdgeGatewayError(error) || isAuthJwtError(error)) {
        console.warn('Edge function retry failed (gateway/auth); falling back to direct DB retry.');
        const fallback = await retryReelDirect(reelId);
        if (!fallback.error) {
          await updateCachedNoteById(reelId, {
            status: 'queued',
            processing_error: undefined,
            updated_at: new Date().toISOString(),
          });
        }
        return fallback;
      }
      console.error('Retry function error:', error);
      return { error };
    }

    await updateCachedNoteById(reelId, {
      status: 'queued',
      processing_error: undefined,
      updated_at: new Date().toISOString(),
    });

    return { status: data?.status || 'queued' };
  } catch (err: any) {
    console.error('Retry reel error:', err);
    return { error: err.message || 'Failed to retry reel processing' };
  }
};

// Database operations using Supabase
export const getAllNotes = async (): Promise<Note[]> => {
  return await readCachedNotes();
};

export const getNotesPage = async (page: number, pageSize: number): Promise<{ notes: Note[]; hasMore: boolean }> => {
  return await getCachedNotesPage(page, pageSize);
};

export const getNoteById = async (id: number): Promise<Note | null> => {
  const notes = await readCachedNotes();
  return notes.find((note) => note.id === id) || null;
};

export const searchNotes = async (query: string): Promise<Note[]> => {
  const result = await getCachedSearchPage(query, 0, Number.MAX_SAFE_INTEGER);
  return result.notes;
};

export const searchNotesPage = async (query: string, page: number, pageSize: number): Promise<{ notes: Note[]; hasMore: boolean }> => {
  return await getCachedSearchPage(query, page, pageSize);
};

export const addNote = async (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<number | null> => {
  const normalizedStructuredText = normalizeText(note.structured_text, '');
  const normalizedStatus = normalizeText(note.status, 'queued');

  // Do not allow saving an empty note as ready.
  if (normalizedStatus === 'ready' && !hasMeaningfulText(normalizedStructuredText)) {
    console.warn('Skipping addNote: ready note has empty content.');
    return null;
  }

  const now = new Date().toISOString();
  const localId = createLocalNoteId();

  const payload = {
    ...note,
    id: localId,
    title: normalizeText(note.title, 'Untitled Note'),
    content_type: normalizeText(note.content_type, 'Recipe'),
    structured_text: normalizedStructuredText,
    status: normalizedStatus as Note['status'],
    created_at: now,
    updated_at: now,
  };

  await upsertCachedNote(payload as Note);

  try {
    await ensureUserSession();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      return localId;
    }

    const { error } = await supabase
      .from('reels')
      .insert([{ ...payload, owner_id: userData.user.id }]);

    if (error) {
      console.warn('Remote addNote failed, local note preserved:', error.message);
    }
  } catch (error) {
    console.warn('Remote addNote failed, local note preserved:', error);
  }

  return localId;
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

  const localUpdated = await updateCachedNoteById(id, normalizedUpdates);
  if (!localUpdated) {
    return false;
  }

  try {
    await ensureUserSession();

    const { error } = await supabase
      .from('reels')
      .update({ ...normalizedUpdates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn('Remote updateNote failed, local update preserved:', error.message);
    }
  } catch (error) {
    console.warn('Remote updateNote failed, local update preserved:', error);
  }

  return true;
};

export const deleteNote = async (id: number): Promise<boolean> => {
  const localDeleted = await removeCachedNoteById(id);
  // If note is already missing locally, keep going and treat remote delete success as valid.

  try {
    await ensureUserSession();

    const { error } = await supabase
      .from('reels')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Remote delete failed, local delete preserved:', error.message);
      return localDeleted;
    }
  } catch (error) {
    console.warn('Remote delete failed, local delete preserved:', error);
    return localDeleted;
  }

  return true;
};

export const getNotesByContentType = async (contentType: string): Promise<Note[]> => {
  const notes = await readCachedNotes();
  return notes.filter((note) => note.content_type === contentType);
};
