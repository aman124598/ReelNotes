import { Note } from './types';

const STORAGE_KEY = 'reelnotes_data';

interface StorageData {
  notes: Note[];
  nextId: number;
}

let cachedData: StorageData | null = null;

const getData = (): StorageData => {
  if (cachedData) return cachedData;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedData = JSON.parse(stored);
      return cachedData!;
    }
  } catch (error) {
    console.error('Error reading from localStorage:', error);
  }
  
  cachedData = { notes: [], nextId: 1 };
  return cachedData;
};

const saveData = (data: StorageData): void => {
  try {
    cachedData = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const initDatabase = () => {
  // Initialize storage if needed
  getData();
};

export const getAllNotes = (): Note[] => {
  const data = getData();
  return [...data.notes].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

export const getNoteById = (id: number): Note | null => {
  const data = getData();
  return data.notes.find(note => note.id === id) || null;
};

export const searchNotes = (query: string): Note[] => {
  const data = getData();
  const searchTerm = query.toLowerCase();
  return data.notes
    .filter(note => 
      note.title.toLowerCase().includes(searchTerm) ||
      note.structured_text.toLowerCase().includes(searchTerm)
    )
    .sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
};

export const addNote = (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): number => {
  const data = getData();
  const now = new Date().toISOString();
  const newNote: Note = {
    ...note,
    id: data.nextId,
    created_at: now,
    updated_at: now,
  };
  
  data.notes.push(newNote);
  data.nextId += 1;
  saveData(data);
  
  return newNote.id;
};

export const updateNote = (id: number, updates: Partial<Note>): void => {
  const data = getData();
  const index = data.notes.findIndex(note => note.id === id);
  
  if (index !== -1) {
    data.notes[index] = {
      ...data.notes[index],
      ...updates,
      id: data.notes[index].id, // Preserve ID
      created_at: data.notes[index].created_at, // Preserve creation date
      updated_at: new Date().toISOString(),
    };
    saveData(data);
  }
};

export const deleteNote = (id: number): void => {
  const data = getData();
  data.notes = data.notes.filter(note => note.id !== id);
  saveData(data);
};

export const getNotesByContentType = (contentType: string): Note[] => {
  const data = getData();
  return data.notes
    .filter(note => note.content_type === contentType)
    .sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
};
