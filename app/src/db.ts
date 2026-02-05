import * as SQLite from 'expo-sqlite';
import { Note } from './types';

const db = SQLite.openDatabaseSync('reelnotes.db');

export const initDatabase = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      content_type TEXT DEFAULT 'Unspecified',
      structured_text TEXT DEFAULT '',
      raw_transcript TEXT DEFAULT '',
      raw_ocr TEXT DEFAULT '',
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_content_type ON notes(content_type);
  `);
};

export const getAllNotes = (): Note[] => {
  return db.getAllSync<Note>('SELECT * FROM notes ORDER BY created_at DESC');
};

export const getNoteById = (id: number): Note | null => {
  return db.getFirstSync<Note>('SELECT * FROM notes WHERE id = ?', [id]);
};

export const searchNotes = (query: string): Note[] => {
  const searchTerm = `%${query}%`;
  return db.getAllSync<Note>(
    'SELECT * FROM notes WHERE title LIKE ? OR structured_text LIKE ? ORDER BY created_at DESC',
    [searchTerm, searchTerm]
  );
};

export const addNote = (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): number => {
  const result = db.runSync(
    'INSERT INTO notes (url, title, content_type, structured_text, raw_transcript, raw_ocr, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [note.url, note.title, note.content_type, note.structured_text, note.raw_transcript || '', note.raw_ocr || '', note.status]
  );
  return result.lastInsertRowId;
};

export const updateNote = (id: number, updates: Partial<Note>): void => {
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'created_at') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.runSync(
    `UPDATE notes SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

export const deleteNote = (id: number): void => {
  db.runSync('DELETE FROM notes WHERE id = ?', [id]);
};

export const getNotesByContentType = (contentType: string): Note[] => {
  return db.getAllSync<Note>(
    'SELECT * FROM notes WHERE content_type = ? ORDER BY created_at DESC',
    [contentType]
  );
};
