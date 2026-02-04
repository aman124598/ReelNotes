-- ReelNotes Database Schema
-- Run this in your Supabase SQL Editor

-- Create reels table
CREATE TABLE IF NOT EXISTS reels (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT DEFAULT 'Unspecified',
  structured_text TEXT DEFAULT '',
  raw_transcript TEXT DEFAULT '',
  raw_ocr TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC);

-- Create index on content_type for filtering
CREATE INDEX IF NOT EXISTS idx_reels_content_type ON reels(content_type);

-- Enable Row Level Security
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations" ON reels;
DROP POLICY IF EXISTS "Enable read access for all users" ON reels;
DROP POLICY IF EXISTS "Enable insert for all users" ON reels;
DROP POLICY IF EXISTS "Enable update for all users" ON reels;
DROP POLICY IF EXISTS "Enable delete for all users" ON reels;

-- Create policies for all operations (adjust for production use)
CREATE POLICY "Enable read access for all users" ON reels
  FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users" ON reels
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON reels
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON reels
  FOR DELETE
  USING (true);

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_reels_updated_at ON reels;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_reels_updated_at 
  BEFORE UPDATE ON reels
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional)
INSERT INTO reels (url, title, content_type, structured_text, raw_transcript, status)
VALUES 
  (
    'https://www.instagram.com/reel/sample123/',
    'Chocolate Chip Cookies Recipe',
    'Recipe',
    E'Title: Perfect Chocolate Chip Cookies\nType: Recipe\n\nIngredients:\n- 2 cups flour\n- 1 cup butter\n- 1 cup chocolate chips\n- 2 eggs\n\nInstructions:\n1. Mix dry ingredients\n2. Cream butter and sugar\n3. Add eggs\n4. Fold in chocolate chips\n5. Bake at 350°F for 12 minutes',
    'Mix flour, butter, chocolate chips, and eggs. Bake for 12 minutes at 350 degrees.',
    'ready'
  )
ON CONFLICT DO NOTHING;

-- Verify the setup
SELECT 
  'Setup complete! ✓' as message,
  COUNT(*) as total_reels
FROM reels;
